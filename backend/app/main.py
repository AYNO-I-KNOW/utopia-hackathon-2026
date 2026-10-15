"""FastAPI routes (ARCHITECTURE.md §3)."""

import json
import threading
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, StringConstraints, ValidationError

from app import config as C
from app.audio import AudioError, DecoderUnavailableError, decode_audio
from app.decision import Decision, decide, top_as_dicts
from app.llm import LlmService, Summariser, no_cry_result
from app.model import CryModel, ModelUnavailableError, get_model
from app.ratelimit import RateLimiter
from app.tts import Speaker, TtsService, TtsUnavailableError, TtsUpstreamError

Lang = Literal["th", "en"]
# Decode + inference are CPU-heavy; shed load instead of queueing behind them.
_INFLIGHT = threading.BoundedSemaphore(C.MAX_CONCURRENT_ANALYSES)
UPLOAD_CHUNK = 64 * 1024
MULTIPART_OVERHEAD = 64 * 1024
MinutesAgo = Annotated[int, Field(strict=True, ge=0)] | None


class ContextIn(BaseModel):
    last_feed_min: MinutesAgo = None
    last_diaper_min: MinutesAgo = None
    last_sleep_end_min: MinutesAgo = None


class SpeakIn(BaseModel):
    text: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=C.TTS_MAX_CHARS),
    ]
    lang: Lang


class TopItem(BaseModel):
    label: str
    prob: float


class AnalyzeOut(BaseModel):
    case: Literal["confident", "close", "unsure", "no_cry"]
    cry_prob: float
    top: list[TopItem]
    ask: list[str]
    summary: str
    checklist: list[str]
    suggest_lullaby: bool
    see_doctor: bool


@lru_cache
def get_settings() -> C.Settings:
    return C.Settings.from_env()


def get_llm(settings: Annotated[C.Settings, Depends(get_settings)]) -> Summariser:
    return _llm_for(settings)


def get_tts(settings: Annotated[C.Settings, Depends(get_settings)]) -> Speaker:
    return _tts_for(settings)


@lru_cache
def _tts_for(settings: C.Settings) -> TtsService:
    return TtsService(settings)  # cached so the daily character budget persists across requests


@lru_cache
def _llm_for(settings: C.Settings) -> LlmService:
    return LlmService(settings)  # cached so the OpenAI client is reused


def _parse_context(raw: str | None) -> ContextIn:
    if raw is None or not raw.strip():
        return ContextIn()
    try:
        return ContextIn.model_validate(json.loads(raw))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail="invalid context JSON") from exc


async def _read_limited(upload: UploadFile) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(UPLOAD_CHUNK):
        total += len(chunk)
        if total > C.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="audio file too large (max 5 MB)")
        chunks.append(chunk)
    if total == 0:
        raise HTTPException(status_code=400, detail="empty audio file")
    return b"".join(chunks)


async def _predict(model: CryModel, data: bytes) -> tuple[float, dict[str, float]]:
    if not _INFLIGHT.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="busy, retry")
    try:
        waveform = await run_in_threadpool(decode_audio, data)
        return await run_in_threadpool(model.predict, waveform)
    except AudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DecoderUnavailableError as exc:
        raise HTTPException(status_code=503, detail="audio decoder unavailable") from exc
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail="model unavailable") from exc
    finally:
        _INFLIGHT.release()


async def _build_response(
    decision: Decision, cry_prob: float, context: dict[str, int], lang: str, llm: Summariser
) -> AnalyzeOut:
    if decision.case == "no_cry":
        result, top = no_cry_result(lang), []
    else:
        result = await llm.summarise(decision.case, list(decision.top), context, lang)
        top = top_as_dicts(decision)
    return AnalyzeOut(
        case=decision.case,
        cry_prob=round(cry_prob, 4),
        top=top,
        ask=list(decision.ask),
        summary=result.summary,
        checklist=list(result.checklist),
        suggest_lullaby=decision.suggest_lullaby,
        see_doctor=result.see_doctor,
    )


def enforce_rate_limit(request: Request) -> None:
    request.app.state.limiter.check(request)


def enforce_speak_rate_limit(request: Request) -> None:
    request.app.state.speak_limiter.check(request)


router = APIRouter()


@router.get("/health")
async def health(model: Annotated[CryModel, Depends(get_model)]) -> dict[str, bool]:
    return {"ok": True, "model_loaded": model.loaded}


@router.post("/analyze", response_model=AnalyzeOut, dependencies=[Depends(enforce_rate_limit)])
async def analyze(
    audio: Annotated[UploadFile, File()],
    lang: Annotated[Lang, Form()],
    model: Annotated[CryModel, Depends(get_model)],
    llm: Annotated[Summariser, Depends(get_llm)],
    context: Annotated[str | None, Form()] = None,
) -> AnalyzeOut:
    ctx = _parse_context(context)
    data = await _read_limited(audio)
    cry_prob, probs = await _predict(model, data)
    ctx_dict: dict[str, Any] = ctx.model_dump()
    decision = decide(cry_prob, probs, ctx_dict)
    known = {k: v for k, v in ctx_dict.items() if v is not None}
    return await _build_response(decision, cry_prob, known, lang, llm)


@router.post("/speak", dependencies=[Depends(enforce_speak_rate_limit)])
async def speak(body: SpeakIn, tts: Annotated[Speaker, Depends(get_tts)]) -> Response:
    try:
        audio = await tts.synthesize(body.text, body.lang)
    except TtsUnavailableError as exc:
        raise HTTPException(status_code=503, detail="text-to-speech unavailable") from exc
    except TtsUpstreamError as exc:
        raise HTTPException(status_code=502, detail="text-to-speech provider error") from exc
    return Response(content=audio, media_type="audio/mpeg")


def _warm_up() -> None:
    model = get_model()
    if hasattr(model, "warm_up"):
        model.warm_up()


@asynccontextmanager
async def lifespan(_: FastAPI):
    threading.Thread(target=_warm_up, daemon=True).start()  # don't block boot
    yield


async def reject_oversize(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/analyze":
        length = request.headers.get("content-length", "")
        if not length.isdigit():  # chunked / missing: can't bound the body up front
            return JSONResponse({"detail": "Content-Length required"}, status_code=411)
        if int(length) > C.MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD:
            return JSONResponse({"detail": "audio file too large (max 5 MB)"}, status_code=413)
    return await call_next(request)


async def bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
    return JSONResponse({"detail": errors}, status_code=400)


def create_app() -> FastAPI:
    app = FastAPI(title="Cry for ur MOM", lifespan=lifespan)
    hops = get_settings().trusted_proxy_hops
    # per app instance, so tests start with a clean budget
    app.state.limiter = RateLimiter(trusted_hops=hops)
    app.state.speak_limiter = RateLimiter(limit=C.SPEAK_RATE_LIMIT_PER_MIN, trusted_hops=hops)
    app.middleware("http")(reject_oversize)
    app.add_middleware(  # added last = outermost, so CORS headers also cover 413/429 replies
        CORSMiddleware,
        allow_origins=list(get_settings().allowed_origins),
        allow_origin_regex=C.CODESANDBOX_ORIGIN_REGEX,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.add_exception_handler(RequestValidationError, bad_request)
    app.include_router(router)
    return app


app = create_app()
