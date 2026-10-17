export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 60;

const AUDIO_TYPES = new Map([
  ["audio/webm", "webm"],
  ["audio/mp4", "mp4"],
  ["audio/mpeg", "mp3"],
  ["audio/mp3", "mp3"],
  ["audio/mpga", "mpga"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"]
]);

export function validateLanguage(language) {
  return language === "en" || language === "ta";
}

export function audioExtension(contentType) {
  return AUDIO_TYPES.get(String(contentType || "").split(";")[0].trim().toLowerCase()) || "";
}

export function hasAudioSignature(contentType, bytes) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (type === "audio/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (type === "audio/mp4" || type === "audio/m4a" || type === "audio/x-m4a") {
    return bytes.length >= 8 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp";
  }
  if (type === "audio/wav" || type === "audio/x-wav") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WAVE";
  }
  if (type === "audio/mpeg" || type === "audio/mp3" || type === "audio/mpga") {
    return bytes.length >= 3 && (
      String.fromCharCode(...bytes.subarray(0, 3)) === "ID3" ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

export function validateAudioMetadata({ type, size, durationSeconds }) {
  if (!audioExtension(type) || !Number.isFinite(size) || size <= 0) return "invalid_audio";
  if (size > MAX_AUDIO_BYTES) return "payload_too_large";
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    return "invalid_audio";
  }
  return "";
}
