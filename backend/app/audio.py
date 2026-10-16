"""Decode any uploaded container (webm/opus, mp4/aac, wav) to 32 kHz mono float32 via ffmpeg."""

import os
import shutil
import subprocess
import tempfile

import numpy as np

from app.config import FFMPEG_FORMAT_WHITELIST, FFMPEG_TIMEOUT_S, MAX_AUDIO_SECONDS, MIN_AUDIO_SECONDS, SAMPLE_RATE


class AudioError(ValueError):
    """Upload is unusable (maps to HTTP 400)."""


class AudioDecodeError(AudioError):
    pass


class AudioTooShortError(AudioError):
    pass


class DecoderUnavailableError(RuntimeError):
    """ffmpeg is not installed on the server (maps to HTTP 503)."""


class DecodeTimeoutError(RuntimeError):
    """ffmpeg exceeded FFMPEG_TIMEOUT_S; retryable, not a bad file (maps to HTTP 503)."""


def decode_audio(data: bytes) -> np.ndarray:
    if not data:
        raise AudioDecodeError("empty audio upload")
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise DecoderUnavailableError("ffmpeg not found on PATH")

    # A temp file (not stdin) so non-streamable mp4 with a trailing moov atom still decodes.
    fd, path = tempfile.mkstemp(prefix="cry_")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        raw = _run_ffmpeg(ffmpeg, path)
    finally:
        os.unlink(path)

    waveform = np.frombuffer(raw, dtype=np.float32).copy()
    if waveform.size == 0:
        raise AudioDecodeError("no audio samples decoded")
    return _check_duration(waveform)


def _run_ffmpeg(ffmpeg: str, path: str) -> bytes:
    cmd = [
        ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin",
        # untrusted input: local file only, known demuxers only (no playlist -> network fetches)
        "-protocol_whitelist", "file", "-format_whitelist", FFMPEG_FORMAT_WHITELIST,
        "-threads", "1",
        "-i", path,
        # parents' clips often run long: analyse only the first MAX_AUDIO_SECONDS instead of rejecting
        "-t", str(MAX_AUDIO_SECONDS),
        "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "pipe:1",
    ]  # fmt: skip
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=FFMPEG_TIMEOUT_S, check=False)
    except subprocess.TimeoutExpired as exc:
        raise DecodeTimeoutError("audio decode timed out") from exc
    if proc.returncode != 0:
        raise AudioDecodeError("could not decode audio (corrupt or unsupported format)")
    return proc.stdout


def _check_duration(waveform: np.ndarray) -> np.ndarray:
    seconds = waveform.size / SAMPLE_RATE
    if seconds < MIN_AUDIO_SECONDS:
        raise AudioTooShortError(f"audio too short: {seconds:.2f}s (min {MIN_AUDIO_SECONDS:g}s)")
    return np.nan_to_num(waveform, nan=0.0, posinf=0.0, neginf=0.0)
