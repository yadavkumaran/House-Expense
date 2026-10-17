import {
  audioExtension,
  hasAudioSignature,
  MAX_AUDIO_BYTES,
  validateAudioMetadata,
  validateLanguage
} from "./validation.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};

function respond(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

export function createTranscriptionHandler({ env, createClient, fetchImpl = fetch }) {
  return async request => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return respond(405, { code: "method_not_allowed" });

    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.match(/^Bearer\s+(\S+)$/i)?.[1];
    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    if (!accessToken || !supabaseUrl || !anonKey) {
      return respond(401, { code: "unauthorized" });
    }

    let supabase;
    try {
      supabase = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } }
      });
    } catch {
      return respond(503, { code: "service_unavailable" });
    }
    let user;
    try {
      const verification = await supabase.auth.getUser(accessToken);
      user = verification.data?.user;
      if (verification.error || !user) return respond(401, { code: "unauthorized" });
    } catch {
      return respond(503, { code: "service_unavailable" });
    }

    const apiKey = env("GROQ_API_KEY");
    if (!apiKey) return respond(503, { code: "provider_not_configured" });

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
      return respond(413, { code: "payload_too_large" });
    }

    let form;
    try {
      form = await request.formData();
    } catch {
      return respond(400, { code: "invalid_audio" });
    }
    const audio = form.get("file");
    const language = form.get("language");
    const durationSeconds = Number(form.get("duration_seconds"));
    if (!(audio instanceof File) || typeof language !== "string" || !validateLanguage(language)) {
      return respond(400, { code: "invalid_audio" });
    }
    const invalid = validateAudioMetadata({ type: audio.type, size: audio.size, durationSeconds });
    if (invalid) return respond(invalid === "payload_too_large" ? 413 : 415, { code: invalid });
    let audioBytes;
    try {
      audioBytes = new Uint8Array(await audio.arrayBuffer());
    } catch {
      return respond(415, { code: "invalid_audio" });
    }
    if (!hasAudioSignature(audio.type, audioBytes)) return respond(415, { code: "invalid_audio" });

    let allowed;
    try {
      const quota = await supabase.rpc("consume_voice_transcription_quota");
      if (quota.error) return respond(503, { code: "service_unavailable" });
      allowed = quota.data;
    } catch {
      return respond(503, { code: "service_unavailable" });
    }
    if (!allowed) return respond(429, { code: "rate_limited" });

    const filename = `expense-recording.${audioExtension(audio.type)}`;
    const providerForm = new FormData();
    providerForm.append("file", new File([audioBytes], filename, { type: audio.type }), filename);
    providerForm.append("model", "whisper-large-v3-turbo");
    providerForm.append("response_format", "json");
    providerForm.append("language", language);
    providerForm.append(
      "prompt",
      "Transcribe the speaker verbatim. The conversation may describe household purchases, amounts in Indian rupees, groceries, electricity, milk, vegetables, or petrol."
    );

    let providerResponse;
    try {
      providerResponse = await fetchImpl("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: providerForm,
        signal: AbortSignal.timeout(60_000)
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        console.warn("Groq transcription request timed out.");
        return respond(504, { code: "provider_timeout" });
      }
      console.warn("Groq transcription request failed before receiving a response.");
      return respond(502, { code: "provider_network_error" });
    }
    if (!providerResponse.ok) {
      const status = providerResponse.status;
      console.warn("Groq transcription request returned an HTTP error.", status);
      if (status === 429) return respond(429, { code: "provider_rate_limited" });
      return respond(status === 401 || status === 403 ? 503 : 502, {
        code: status === 401 || status === 403 ? "provider_unavailable" : "provider_error"
      });
    }

    let transcript;
    try {
      const result = await providerResponse.json();
      transcript = typeof result.text === "string" ? result.text.trim() : "";
    } catch {
      return respond(502, { code: "provider_error" });
    }
    return respond(200, { transcript });
  };
}
