export const MIN_RECORD_SECONDS = 3;
export const MAX_RECORD_SECONDS = 10;
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export type Recorder = {
  pause: () => void;
  resume: () => void;
  /** Stop and resolve the recorded audio; null when nothing was captured. */
  finish: () => Promise<Blob | null>;
  dispose: () => void;
};

/** Record the same mic stream that drives the waveform. */
export function createRecorder(stream: MediaStream): Recorder {
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start();
  return {
    pause: () => recorder.state === "recording" && recorder.pause(),
    resume: () => recorder.state === "paused" && recorder.resume(),
    finish: () =>
      new Promise((resolve) => {
        const done = () =>
          resolve(
            chunks.length
              ? new Blob(chunks, { type: recorder.mimeType || mimeType })
              : null,
          );
        if (recorder.state === "inactive") return done();
        recorder.onstop = done;
        recorder.stop();
      }),
    dispose: () => {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    },
  };
}
