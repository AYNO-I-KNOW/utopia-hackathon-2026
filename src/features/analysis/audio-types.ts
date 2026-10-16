// Formats the backend's ffmpeg whitelist accepts.
const MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "audio/ogg",
  "audio/opus",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".mp4",
  ".mov",
  ".aac",
  ".wav",
  ".webm",
  ".ogg",
  ".opus",
];

export const AUDIO_ACCEPT = [...MIME_TYPES, ...EXTENSIONS].join(",");

/** `accept` is only a hint, so the picked file is checked again by extension or MIME type. */
export function isSupportedAudio(file: { name: string; type: string }) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase().split(";")[0].trim();
  return (
    EXTENSIONS.some((ext) => name.endsWith(ext)) || MIME_TYPES.includes(type)
  );
}
