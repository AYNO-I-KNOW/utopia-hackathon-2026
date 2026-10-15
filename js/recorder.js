// getUserMedia + MediaRecorder + live input level (for the waveform).
import { REC_MAX_SEC } from './config.js';

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const FFT_SIZE = 512;
const LEVEL_GAIN = 6;

// code: insecure | unsupported | denied | nomic | failed
export class RecorderError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function assertSupported() {
  if (!window.isSecureContext) throw new RecorderError('insecure');
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new RecorderError('unsupported');
  }
}

function micErrorCode(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') return 'denied';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'nomic';
  return 'failed';
}

async function openMic() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw new RecorderError(micErrorCode(err));
  }
}

const stopTracks = (stream) => stream.getTracks().forEach((track) => track.stop());
const pickMimeType = () => MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';

function closeContext(ctx) {
  try {
    ctx?.close().catch(() => {});
  } catch (e) {
    // already closed
  }
}

// Call synchronously inside the tap handler, before awaiting getUserMedia: Safari/iOS only
// let an AudioContext start (resume) during a user gesture. Returns null if unsupported.
export function createAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    const ctx = new AudioCtx();
    ctx.resume?.()?.catch(() => {});
    return ctx;
  } catch (e) {
    return null;
  }
}

function rmsLevel(samples) {
  let sum = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    sum += value * value;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * LEVEL_GAIN);
}

// onLevel(0..1) every animation frame. A meter failure must not break recording.
// stop() always closes the AudioContext.
function startMeter(ctx, stream, onLevel) {
  const noop = { stop: () => closeContext(ctx) };
  if (!ctx || !onLevel) return noop;
  try {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let active = true;
    const loop = () => {
      if (!active) return;
      analyser.getByteTimeDomainData(samples);
      onLevel(rmsLevel(samples));
      frame = requestAnimationFrame(loop);
    };
    loop();
    return {
      stop() {
        active = false;
        cancelAnimationFrame(frame);
        closeContext(ctx);
      },
    };
  } catch (e) {
    return noop;
  }
}

function createSession(stream, { audioContext, onLevel, onLimit, onEnded }) {
  const mimeType = pickMimeType();
  const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  let closed = false;
  let meter = { stop: () => closeContext(audioContext) };
  let limitTimer = 0;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearTimeout(limitTimer);
    meter.stop();
    stopTracks(stream);
  };
  const makeBlob = () => new Blob(chunks, { type: media.mimeType || mimeType || 'audio/webm' });
  // Mic unplugged / revoked / recorder crashed while recording.
  const handleEnded = () => {
    if (closed) return;
    onEnded?.();
  };

  media.addEventListener('dataavailable', (event) => {
    if (event.data.size) chunks.push(event.data);
  });
  media.addEventListener('error', handleEnded);
  stream.getTracks().forEach((track) => track.addEventListener('ended', handleEnded));
  media.start();
  meter = startMeter(audioContext, stream, onLevel);
  limitTimer = setTimeout(() => onLimit?.(), REC_MAX_SEC * 1000);

  return {
    // Resolves with the recorded Blob and releases the microphone.
    stop: () => new Promise((resolve) => {
      if (media.state === 'inactive') {
        cleanup();
        resolve(makeBlob());
        return;
      }
      media.addEventListener('stop', () => {
        cleanup();
        resolve(makeBlob());
      }, { once: true });
      media.stop();
    }),
    // Discards the recording and releases the microphone.
    cancel: () => {
      cleanup();
      if (media.state !== 'inactive') media.stop();
    },
  };
}

// audioContext: from createAudioContext(); owned (closed) by the recorder from here on.
export async function startRecorder({ audioContext, onLevel, onLimit, onEnded }) {
  let stream = null;
  try {
    assertSupported();
    stream = await openMic();
    return createSession(stream, { audioContext, onLevel, onLimit, onEnded });
  } catch (err) {
    if (stream) stopTracks(stream);
    closeContext(audioContext);
    throw err instanceof RecorderError ? err : new RecorderError('failed');
  }
}
