import shutil
import subprocess

import numpy as np
import pytest

from app.audio import AudioDecodeError, AudioTooLongError, AudioTooShortError, decode_audio
from app.config import SAMPLE_RATE
from tests.conftest import make_wav

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")


def test_decodes_wav_to_32khz_mono_float32():
    out = decode_audio(make_wav(2.0, rate=16_000))
    assert out.dtype == np.float32 and out.ndim == 1
    assert abs(out.size - 2 * SAMPLE_RATE) < SAMPLE_RATE * 0.05
    assert 0.1 < float(np.abs(out).max()) <= 1.0


def test_rejects_short_audio():
    with pytest.raises(AudioTooShortError):
        decode_audio(make_wav(0.5))


def test_rejects_long_audio():
    with pytest.raises(AudioTooLongError):
        decode_audio(make_wav(31, rate=8000))


def test_accepts_boundary_lengths():
    assert decode_audio(make_wav(1.2)).size > 0
    assert decode_audio(make_wav(29.5, rate=8000)).size > 0


def test_rejects_garbage_and_empty():
    with pytest.raises(AudioDecodeError):
        decode_audio(b"definitely not audio" * 20)
    with pytest.raises(AudioDecodeError):
        decode_audio(b"")


def test_decodes_aac_in_mp4_container(tmp_path):
    src = tmp_path / "in.wav"
    src.write_bytes(make_wav(2.0))
    dst = tmp_path / "out.m4a"
    run = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-c:a", "aac", str(dst)],
        capture_output=True,
    )
    if run.returncode != 0:
        pytest.skip("ffmpeg build has no aac encoder")
    assert decode_audio(dst.read_bytes()).size > SAMPLE_RATE


def test_playlist_upload_rejected_without_network_access():
    import socket

    canary = socket.socket()
    canary.bind(("127.0.0.1", 0))
    canary.listen(1)
    canary.setblocking(False)
    url = f"http://127.0.0.1:{canary.getsockname()[1]}/x.wav"
    playlist = (
        "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n"
        f"#EXTINF:1,\n{url}\n#EXT-X-ENDLIST\n"
    ).encode()
    try:
        with pytest.raises(AudioDecodeError):
            decode_audio(playlist)
        with pytest.raises(BlockingIOError):  # nobody connected to the canary
            canary.accept()
    finally:
        canary.close()


def test_ffmpeg_concat_script_rejected(tmp_path):
    target = tmp_path / "real.wav"
    target.write_bytes(make_wav(2.0))
    with pytest.raises(AudioDecodeError):
        decode_audio(f"ffconcat version 1.0\nfile '{target}'\n".encode())


@pytest.mark.parametrize(
    ("codec", "ext"),
    [("libopus", "webm"), ("libvorbis", "ogg"), ("libmp3lame", "mp3"), ("aac", "aac")],
)
def test_whitelisted_containers_still_decode(tmp_path, codec, ext):
    src, dst = tmp_path / "in.wav", tmp_path / f"out.{ext}"
    src.write_bytes(make_wav(2.0))
    run = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-c:a", codec, str(dst)],
        capture_output=True,
    )
    if run.returncode != 0:
        pytest.skip(f"ffmpeg build lacks {codec}")
    assert decode_audio(dst.read_bytes()).size > SAMPLE_RATE
