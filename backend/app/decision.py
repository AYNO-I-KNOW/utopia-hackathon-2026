"""Pure decision logic (§4): activity priors, 4-case classification, ask/lullaby rules."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from app import config as C

Case = Literal["no_cry", "confident", "close", "unsure"]
Context = Mapping[str, int | None]

TOP_N = 3
EPS = 1e-9  # so 0.60 - 0.45 counts as exactly the 0.15 margin despite float error


@dataclass(frozen=True)
class Decision:
    case: Case
    top: tuple[tuple[str, float], ...]
    ask: tuple[str, ...]
    suggest_lullaby: bool


def apply_priors(probs: Mapping[str, float], context: Context | None) -> dict[str, float]:
    """Scale class probs by activity context, then renormalise. Returns a new dict."""
    ctx = context or {}
    mult = {label: 1.0 for label in probs}

    def scale(label: str, factor: float) -> None:
        if label in mult:
            mult[label] *= factor

    feed, diaper, sleep_end = (
        ctx.get("last_feed_min"),
        ctx.get("last_diaper_min"),
        ctx.get("last_sleep_end_min"),
    )
    if feed is not None and feed < C.FEED_RECENT_MIN:
        scale("hungry", C.HUNGRY_RECENT_MULT)
    if feed is not None and feed > C.FEED_LONG_MIN:
        scale("hungry", C.HUNGRY_LONG_MULT)
    if diaper is not None and diaper < C.DIAPER_RECENT_MIN:
        scale("diaper", C.DIAPER_RECENT_MULT)
    if sleep_end is not None and sleep_end > C.SLEEP_END_LONG_MIN:
        scale("sleepy", C.SLEEPY_LONG_MULT)

    adjusted = {label: p * mult[label] for label, p in probs.items()}
    total = sum(adjusted.values())
    if total <= 0:
        return dict(probs)
    return {label: p / total for label, p in adjusted.items()}


def rank(probs: Mapping[str, float]) -> list[tuple[str, float]]:
    """Descending by prob; ties broken by label so output is deterministic."""
    return sorted(probs.items(), key=lambda kv: (-kv[1], kv[0]))


def classify_case(cry_prob: float, ranked: list[tuple[str, float]]) -> Case:
    """Precedence: no_cry > unsure > close > confident.

    Each rule only sees inputs the earlier ones rejected, so every input maps to exactly one
    case: unsure = top1 < 0.40; close = margin < 0.15; confident = everything left
    (top1 >= 0.40 and margin >= 0.15, so a clear leader below 0.60 is still confident).
    """
    if cry_prob < C.CRY_THRESHOLD:
        return "no_cry"
    top1 = ranked[0][1] if ranked else 0.0
    top2 = ranked[1][1] if len(ranked) > 1 else 0.0
    if top1 < C.UNSURE_MAX:
        return "unsure"
    if (top1 - top2) < C.CLOSE_MARGIN - EPS:
        return "close"
    return "confident"


def missing_context(context: Context | None) -> tuple[str, ...]:
    ctx = context or {}
    asks = (("last_feed", "last_feed_min"), ("last_diaper", "last_diaper_min"))
    return tuple(name for name, key in asks if ctx.get(key) is None)


def decide(cry_prob: float, probs: Mapping[str, float], context: Context | None) -> Decision:
    ranked = rank(apply_priors(probs, context))
    case = classify_case(cry_prob, ranked)
    top = tuple(ranked[:TOP_N])
    top1_label = top[0][0] if top else None
    return Decision(
        case=case,
        top=top,
        ask=missing_context(context) if case == "close" else (),
        suggest_lullaby=case != "no_cry"
        and (case == "unsure" or top1_label in C.LULLABY_LABELS),
    )


def top_as_dicts(decision: Decision) -> list[dict[str, Any]]:
    return [{"label": label, "prob": round(prob, 4)} for label, prob in decision.top]
