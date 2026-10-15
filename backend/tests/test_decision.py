import pytest

from app import config as C
from app.decision import apply_priors, classify_case, decide, missing_context, rank

SIX = {"hungry": 0.4, "hug": 0.1, "awake": 0.1, "uncomfortable": 0.1, "sleepy": 0.2, "diaper": 0.1}


def ranked(top1: float, top2: float):
    return [("a", top1), ("b", top2), ("c", 0.01)]


class TestApplyPriors:
    def test_no_context_returns_equal_copy(self):
        out = apply_priors(SIX, None)
        assert out == pytest.approx(SIX)
        assert out is not SIX

    def test_does_not_mutate_inputs(self):
        probs, ctx = dict(SIX), {"last_feed_min": 10}
        apply_priors(probs, ctx)
        assert probs == SIX and ctx == {"last_feed_min": 10}

    def test_recent_feed_halves_hungry_then_renormalises(self):
        out = apply_priors(SIX, {"last_feed_min": 59})
        assert sum(out.values()) == pytest.approx(1.0)
        assert out["hungry"] == pytest.approx(0.2 / 0.8)

    def test_feed_boundaries_exclusive(self):
        assert apply_priors(SIX, {"last_feed_min": 60}) == pytest.approx(SIX)
        assert apply_priors(SIX, {"last_feed_min": 180}) == pytest.approx(SIX)

    def test_long_since_feed_boosts_hungry(self):
        out = apply_priors(SIX, {"last_feed_min": 181})
        assert out["hungry"] == pytest.approx(0.6 / 1.2)

    def test_recent_diaper_halves_diaper(self):
        out = apply_priors(SIX, {"last_diaper_min": 29})
        assert out["diaper"] == pytest.approx(0.05 / 0.95)
        assert apply_priors(SIX, {"last_diaper_min": 30}) == pytest.approx(SIX)

    def test_sleep_end_boosts_sleepy(self):
        out = apply_priors(SIX, {"last_sleep_end_min": 121})
        assert out["sleepy"] == pytest.approx(0.26 / 1.06)
        assert apply_priors(SIX, {"last_sleep_end_min": 120}) == pytest.approx(SIX)

    def test_none_values_ignored(self):
        ctx = {"last_feed_min": None, "last_diaper_min": None, "last_sleep_end_min": None}
        assert apply_priors(SIX, ctx) == pytest.approx(SIX)

    def test_missing_label_is_skipped(self):
        out = apply_priors({"awake": 0.5, "hug": 0.5}, {"last_feed_min": 5})
        assert out == pytest.approx({"awake": 0.5, "hug": 0.5})

    def test_all_zero_probs_do_not_divide_by_zero(self):
        assert apply_priors({"hungry": 0.0}, {"last_feed_min": 5}) == {"hungry": 0.0}


class TestClassifyCase:
    def test_no_cry_below_threshold(self):
        assert classify_case(C.CRY_THRESHOLD - 0.01, ranked(0.9, 0.05)) == "no_cry"

    def test_cry_threshold_boundary_is_a_cry(self):
        assert classify_case(C.CRY_THRESHOLD, ranked(0.9, 0.05)) == "confident"

    def test_no_cry_beats_everything(self):
        assert classify_case(0.0, ranked(0.2, 0.2)) == "no_cry"

    def test_unsure_below_040(self):
        assert classify_case(0.9, ranked(0.39, 0.10)) == "unsure"

    def test_040_is_not_unsure(self):
        assert classify_case(0.9, ranked(0.40, 0.10)) != "unsure"

    def test_confident_at_exact_margin_boundary(self):
        assert classify_case(0.9, ranked(0.60, 0.45)) == "confident"
        assert classify_case(0.9, ranked(0.40, 0.25)) == "confident"

    def test_just_under_margin_is_close(self):
        assert classify_case(0.9, ranked(0.60, 0.46)) == "close"
        assert classify_case(0.9, ranked(0.40, 0.26)) == "close"

    def test_clear_leader_below_060_is_confident(self):
        assert classify_case(0.9, ranked(0.50, 0.20)) == "confident"

    def test_high_top1_small_margin_is_close(self):
        assert classify_case(0.9, ranked(0.62, 0.55)) == "close"

    def test_039_is_unsure_even_with_big_margin(self):
        assert classify_case(0.9, ranked(0.39, 0.01)) == "unsure"

    def test_unsure_beats_close(self):
        assert classify_case(0.9, ranked(0.30, 0.29)) == "unsure"

    def test_single_class(self):
        assert classify_case(0.9, [("a", 1.0)]) == "confident"

    def test_every_grid_point_maps_to_one_case(self):
        valid = {"no_cry", "confident", "close", "unsure"}
        for cry in (0.0, 0.29, 0.3, 1.0):
            for t1 in (i / 20 for i in range(1, 21)):
                for t2 in (i / 20 for i in range(0, 20) if i / 20 <= t1):
                    assert classify_case(cry, ranked(t1, t2)) in valid


class TestDecide:
    def test_confident_hungry(self):
        probs = {"hungry": 0.8, "sleepy": 0.1, "diaper": 0.06, "hug": 0.04}
        d = decide(0.97, probs, {})
        assert d.case == "confident"
        assert [label for label, _ in d.top] == ["hungry", "sleepy", "diaper"]
        assert d.ask == ()
        assert d.suggest_lullaby is False

    def test_top_is_three_and_sorted(self):
        d = decide(0.9, SIX, None)
        assert len(d.top) == 3
        assert d.top[0][1] >= d.top[1][1] >= d.top[2][1]

    def test_priors_can_flip_case(self):
        probs = {"hungry": 0.50, "sleepy": 0.40, "diaper": 0.10}
        assert decide(0.9, probs, {}).case == "close"
        assert decide(0.9, probs, {"last_feed_min": 181}).case == "confident"

    def test_close_asks_for_missing_context_only(self):
        probs = {"hungry": 0.45, "diaper": 0.40, "sleepy": 0.15}
        assert decide(0.9, probs, {}).ask == ("last_feed", "last_diaper")
        assert decide(0.9, probs, {"last_feed_min": 100}).ask == ("last_diaper",)
        assert decide(0.9, probs, {"last_diaper_min": 100}).ask == ("last_feed",)

    def test_close_with_full_context_asks_nothing(self):
        probs = {"hungry": 0.45, "diaper": 0.40, "sleepy": 0.15}
        ctx = {"last_feed_min": 100, "last_diaper_min": 100}
        assert decide(0.9, probs, ctx).ask == ()

    def test_null_context_value_counts_as_missing(self):
        assert missing_context({"last_feed_min": None, "last_diaper_min": 5}) == ("last_feed",)

    def test_zero_minutes_counts_as_known(self):
        assert missing_context({"last_feed_min": 0, "last_diaper_min": 0}) == ()

    def test_ask_empty_for_non_close_cases(self):
        assert decide(0.9, {"hungry": 0.9, "sleepy": 0.1}, {}).ask == ()
        assert decide(0.9, {"a": 0.2, "b": 0.2, "c": 0.2, "d": 0.2, "e": 0.2}, {}).ask == ()

    @pytest.mark.parametrize("label", ["sleepy", "hug", "awake"])
    def test_lullaby_for_calming_labels(self, label):
        d = decide(0.9, {label: 0.9, "hungry": 0.1}, {})
        assert d.case == "confident" and d.suggest_lullaby is True

    def test_lullaby_for_unsure(self):
        probs = {"hungry": 0.3, "diaper": 0.25, "uncomfortable": 0.25, "belly_pain": 0.2}
        d = decide(0.9, probs, {})
        assert d.case == "unsure" and d.suggest_lullaby is True

    def test_no_lullaby_for_no_cry(self):
        d = decide(0.1, {"sleepy": 0.9, "hungry": 0.1}, {})
        assert d.case == "no_cry" and d.suggest_lullaby is False

    def test_decide_does_not_mutate_inputs(self):
        probs, ctx = dict(SIX), {"last_feed_min": 10}
        decide(0.9, probs, ctx)
        assert probs == SIX and ctx == {"last_feed_min": 10}

    def test_rank_ties_are_deterministic(self):
        assert rank({"b": 0.5, "a": 0.5}) == [("a", 0.5), ("b", 0.5)]
