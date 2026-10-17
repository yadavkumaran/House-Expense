import test from "node:test";
import assert from "node:assert/strict";
import { createTranscriptionHandler } from "../supabase/functions/transcribe-expense/handler.mjs";
import {
  MAX_AUDIO_BYTES,
  MAX_DURATION_SECONDS,
  audioExtension,
  hasAudioSignature,
  validateAudioMetadata,
  validateLanguage
} from "../supabase/functions/transcribe-expense/validation.mjs";

const defaultEnv = {
  SUPABASE_URL: "https://project.example",
  SUPABASE_ANON_KEY: "public-anon-key",
  GROQ_API_KEY: "server-only-test-key"
};

function harness({ env = {}, user = { id: "user-1" }, authError = null, quota = true, quotaError = null, fetchImpl } = {}) {
  const calls = { token: "", clientOptions: null, quota: 0, provider: 0, providerRequest: null };
  const values = { ...defaultEnv, ...env };
  const handler = createTranscriptionHandler({
    env: name => values[name],
    createClient: (_url, _key, options) => {
      calls.clientOptions = options;
      return {
        auth: { getUser: async token => {
          calls.token = token;
          return { data: { user }, error: authError };
        } },
        rpc: async name => {
          assert.equal(name, "consume_voice_transcription_quota");
          calls.quota += 1;
          return { data: quota, error: quotaError };
        }
      };
    },
    fetchImpl: fetchImpl || (async (url, options) => {
      calls.provider += 1;
      calls.providerRequest = { url, options };
      return Response.json({
        text: options.body.get("language") === "ta" ? "மளிகைக்கு 250 ரூபாய் செலவிட்டேன்." : "I spent 250 rupees on groceries today."
      });
    })
  });
  return { handler, calls };
}

function recordingBytes(type, size, signature = true) {
  const bytes = new Uint8Array(size);
  if (!signature || size < 12) return bytes;
  const header = type.startsWith("audio/webm") ? [0x1a, 0x45, 0xdf, 0xa3]
    : type.includes("mp4") || type.includes("m4a") ? [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]
      : type.includes("wav") ? [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]
        : type.includes("mpeg") || type.includes("mp3") || type.includes("mpga") ? [0x49, 0x44, 0x33]
          : [];
  bytes.set(header.slice(0, size));
  return bytes;
}

function transcriptionRequest({ token = "signed-in-user-token", type = "audio/webm", size = 12, language = "en", duration = 4, signature = true } = {}) {
  const form = new FormData();
  form.append("file", new Blob([recordingBytes(type, size, signature)], { type }), "recording.webm");
  form.append("language", language);
  form.append("duration_seconds", String(duration));
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return new Request("https://edge.example/transcribe-expense", { method: "POST", headers, body: form });
}

async function responseJson(response) {
  return { status: response.status, body: await response.json() };
}

test("allows only the explicitly supported English and Tamil language codes", () => {
  assert.equal(validateLanguage("en"), true);
  assert.equal(validateLanguage("ta"), true);
  assert.equal(validateLanguage("en-IN"), false);
  assert.equal(validateLanguage("fr"), false);
});

test("maps supported browser recording types to provider-compatible filenames", () => {
  assert.equal(audioExtension("audio/webm;codecs=opus"), "webm");
  assert.equal(audioExtension("audio/mp4"), "mp4");
  assert.equal(audioExtension("audio/ogg"), "");
  assert.equal(hasAudioSignature("audio/webm;codecs=opus", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])), true);
  assert.equal(hasAudioSignature("audio/webm", new Uint8Array([0, 0, 0, 0])), false);
});

test("rejects empty, unsupported, oversized, and overlong recordings", () => {
  assert.equal(validateAudioMetadata({ type: "audio/webm", size: 0, durationSeconds: 1 }), "invalid_audio");
  assert.equal(validateAudioMetadata({ type: "audio/ogg", size: 10, durationSeconds: 1 }), "invalid_audio");
  assert.equal(validateAudioMetadata({ type: "audio/webm", size: MAX_AUDIO_BYTES + 1, durationSeconds: 1 }), "payload_too_large");
  assert.equal(validateAudioMetadata({ type: "audio/webm", size: 10, durationSeconds: MAX_DURATION_SECONDS + 1 }), "invalid_audio");
  assert.equal(validateAudioMetadata({ type: "audio/webm", size: 10, durationSeconds: 0 }), "invalid_audio");
});

test("accepts non-empty audio within the size and duration limits", () => {
  assert.equal(validateAudioMetadata({ type: "audio/mp4", size: MAX_AUDIO_BYTES, durationSeconds: MAX_DURATION_SECONDS }), "");
});

test("handles preflight and rejects missing or invalid Supabase sessions", async () => {
  const unauthorized = harness({ authError: new Error("invalid token"), user: null });
  assert.equal((await responseJson(await unauthorized.handler(transcriptionRequest({ token: "" })))).status, 401);
  assert.equal((await responseJson(await unauthorized.handler(transcriptionRequest()))).body.code, "unauthorized");
  assert.equal(unauthorized.calls.provider, 0);

  const preflight = await harness().handler(new Request("https://edge.example/transcribe-expense", { method: "OPTIONS" }));
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
});

test("fails safely when the Groq API key is missing or rejected", async () => {
  const missing = harness({ env: { GROQ_API_KEY: undefined } });
  assert.deepEqual(await responseJson(await missing.handler(transcriptionRequest())), {
    status: 503, body: { code: "provider_not_configured" }
  });
  assert.equal(missing.calls.provider, 0);

  const rejected = harness({
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "secret provider diagnostics" } }), { status: 401 })
  });
  const result = await responseJson(await rejected.handler(transcriptionRequest()));
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "provider_unavailable");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("rejects unsupported languages, audio formats, empty files and overlong recordings", async () => {
  for (const options of [
    { language: "en-IN" }, { type: "audio/ogg" }, { size: 0 }, { duration: 61 }, { signature: false }
  ]) {
    const instance = harness();
    const result = await responseJson(await instance.handler(transcriptionRequest(options)));
    assert.ok(result.status === 400 || result.status === 415);
    assert.equal(instance.calls.provider, 0);
  }
});

test("applies the per-user rate limit before contacting the provider", async () => {
  const instance = harness({ quota: false });
  assert.deepEqual(await responseJson(await instance.handler(transcriptionRequest())), {
    status: 429, body: { code: "rate_limited" }
  });
  assert.equal(instance.calls.provider, 0);
});

test("verifies Supabase auth and sends English and Tamil audio to Groq in the required format", async () => {
  for (const language of ["en", "ta"]) {
    const instance = harness();
    const result = await responseJson(await instance.handler(transcriptionRequest({ language })));
    assert.equal(result.status, 200);
    assert.equal(result.body.transcript, language === "ta" ? "மளிகைக்கு 250 ரூபாய் செலவிட்டேன்." : "I spent 250 rupees on groceries today.");
    assert.equal(instance.calls.token, "signed-in-user-token");
    assert.equal(instance.calls.clientOptions.global.headers.Authorization, "Bearer signed-in-user-token");
    assert.equal(instance.calls.quota, 1);
    assert.equal(instance.calls.provider, 1);
    assert.equal(instance.calls.providerRequest.url, "https://api.groq.com/openai/v1/audio/transcriptions");
    assert.equal(instance.calls.providerRequest.options.method, "POST");
    assert.equal(instance.calls.providerRequest.options.headers.Authorization, "Bearer server-only-test-key");
    const providerForm = instance.calls.providerRequest.options.body;
    assert.equal(providerForm.get("model"), "whisper-large-v3-turbo");
    assert.equal(providerForm.get("language"), language);
    assert.equal(providerForm.get("response_format"), "json");
  }
});

test("distinguishes Groq rate limits, provider errors, network failures, and timeouts safely", async () => {
  const limited = harness({
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "private quota detail" } }), { status: 429 })
  });
  assert.deepEqual(await responseJson(await limited.handler(transcriptionRequest())), {
    status: 429, body: { code: "provider_rate_limited" }
  });

  const failed = harness({
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "private provider detail" } }), { status: 500 })
  });
  assert.deepEqual(await responseJson(await failed.handler(transcriptionRequest())), {
    status: 502, body: { code: "provider_error" }
  });

  const networkFailure = harness({ fetchImpl: async () => { throw new TypeError("private network detail"); } });
  assert.deepEqual(await responseJson(await networkFailure.handler(transcriptionRequest())), {
    status: 502, body: { code: "provider_network_error" }
  });

  const timeout = harness({ fetchImpl: async () => { throw new DOMException("private timeout detail", "TimeoutError"); } });
  assert.deepEqual(await responseJson(await timeout.handler(transcriptionRequest())), {
    status: 504, body: { code: "provider_timeout" }
  });
});

test("returns an empty transcript safely", async () => {
  const empty = harness({ fetchImpl: async () => Response.json({ text: "  " }) });
  assert.deepEqual(await responseJson(await empty.handler(transcriptionRequest())), {
    status: 200, body: { transcript: "" }
  });
});
