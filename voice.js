const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  lakh: 100000, lac: 100000
};

const TAMIL_NUMBERS = {
  "பூஜ்ஜியம்": 0, "ஒன்று": 1, "ஒரு": 1, "இரண்டு": 2, "மூன்று": 3, "நான்கு": 4, "ஐந்து": 5,
  "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10, "பதினொன்று": 11, "பன்னிரண்டு": 12,
  "பதின்மூன்று": 13, "பதினான்கு": 14, "பதினைந்து": 15, "பதினாறு": 16, "பதினேழு": 17,
  "பதினெட்டு": 18, "பத்தொன்பது": 19, "இருபது": 20, "முப்பது": 30, "நாற்பது": 40,
  "ஐம்பது": 50, "அறுபது": 60, "எழுபது": 70, "எண்பது": 80, "தொண்ணூறு": 90, "நூறு": 100,
  "இருநூறு": 200, "முன்னூறு": 300, "நானூறு": 400, "ஐந்நூறு": 500, "அறுநூறு": 600,
  "எழுநூறு": 700, "எண்ணூறு": 800, "தொள்ளாயிரம்": 900,
  "ஆயிரம்": 1000
};

export function transcriptionFailureKey(status, code = "") {
  if (status === 404 || code === "NOT_FOUND" || code === "FUNCTION_NOT_FOUND") return "voiceFunctionNotDeployed";
  if (status === 401 || code === "unauthorized") return "voiceSessionExpired";
  if (status === 413 || code === "payload_too_large") return "voiceTooLarge";
  if (status === 415 || code === "invalid_audio") return "voiceInvalidAudio";
  if (code === "provider_not_configured") return "voiceProviderNotConfigured";
  if (code === "provider_rate_limited") return "voiceProviderRateLimited";
  if (code === "provider_timeout") return "voiceTimeout";
  if (code === "provider_network_error") return "voiceProviderNetworkError";
  if (status === 429 || code === "rate_limited") return "voiceRateLimited";
  if (["provider_unavailable", "provider_error", "service_unavailable"].includes(code) || status >= 500) {
    return "voiceProviderError";
  }
  return "voiceRequestError";
}

export async function diagnoseTranscriptionEndpoint(endpoint, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });
    if (response.status === 404) return "voiceFunctionNotDeployed";
    if (response.status >= 500) return "voiceProviderError";
    return "voiceRequestBlocked";
  } catch {
    return "voiceNetworkError";
  } finally {
    clearTimeout(timeout);
  }
}

function wordsToNumber(words) {
  let total = 0;
  let group = 0;
  for (const word of words) {
    if (word === "and") continue;
    const value = NUMBER_WORDS[word] ?? TAMIL_NUMBERS[word];
    if (value == null) return null;
    if (value === 100 || value === 1000 || value === 100000) {
      group = Math.max(1, group) * value;
      if (value > 100) {
        total += group;
        group = 0;
      }
    } else {
      group += value;
    }
  }
  return total + group;
}

function amountFromTranscript(transcript) {
  const currencyAmount = transcript.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)(?:\s*rupees?)?|\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|ரூபாய்)\b/i);
  if (currencyAmount) {
    const amount = Number((currencyAmount[1] || currencyAmount[2]).replaceAll(",", ""));
    return Number.isFinite(amount) && amount > 0 ? { amount, match: currencyAmount[0] } : null;
  }
  const bareAmount = transcript.match(/\b\d[\d,]*(?:\.\d{1,2})?\b/);
  if (bareAmount) {
    const offset = bareAmount.index || 0;
    const before = transcript.slice(0, offset).toLowerCase().trimEnd();
    const after = transcript.slice(offset + bareAmount[0].length).toLowerCase().trimStart();
    const spokenAsAmount = /(?:spent|paid|pay|add|record)$/.test(before) && /^(?:for|on|at|to)\b/.test(after);
    const amount = Number(bareAmount[0].replaceAll(",", ""));
    if (spokenAsAmount && Number.isFinite(amount) && amount > 0) {
      return { amount, match: bareAmount[0] };
    }
  }

  const words = transcript.toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
  const starts = words.map((word, index) => NUMBER_WORDS[word] != null || TAMIL_NUMBERS[word] != null ? index : -1).filter(index => index >= 0);
  for (const start of starts) {
    const sequence = [];
    for (const word of words.slice(start)) {
      if (NUMBER_WORDS[word] == null && TAMIL_NUMBERS[word] == null && word !== "and") break;
      sequence.push(word);
    }
    const amount = wordsToNumber(sequence);
    const end = start + sequence.length;
    const currencyFollows = /^(rupees?|rs|inr|ரூபாய்)$/.test(words[end] || "");
    const expenseVerbBefore = /^(spent|paid|pay|add|record)$/.test(words[start - 1] || "") ||
      /^(spent|paid|pay|add|record)$/.test(words[start - 2] || "");
    const amountPhraseBeforeItem = amount >= 10 && expenseVerbBefore && /^(for|on|at|to)$/.test(words[end] || "");
    if (amount > 0 && (currencyFollows || amountPhraseBeforeItem)) {
      return { amount, match: sequence.join(" ") };
    }
  }
  return null;
}

function dateForOffset(offset, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const CATEGORY_PATTERNS = [
  ["veg", /\b(vegetables?|veggies)\b|காய்கறி/u],
  ["groc", /\b(grocer(?:y|ies)|food|supermarket)\b|மளிகை|உணவு/u],
  ["milk", /\b(milk|dairy)\b|பால்/u],
  ["snk", /\b(snack|snacks)\b|தின்பண்டம்/u],
  ["rent", /\b(rent|lease|landlord)\b|வாடகை/u],
  ["bill", /\b(electricity|electric|utility|utilities|bill|bills)\b|மின்சாரம்/u],
  ["gas", /\b(cooking gas|gas)\b|எரிவாயு/u],
  ["hlth", /\b(health|medical|medicine|medicines|doctor|pharmacy)\b|மருத்துவம்|மருந்து/u],
  ["trans", /\b(transport(?:ation)?|taxi|uber|bus|train|petrol|fuel)\b|போக்குவரத்து/u],
  ["shop", /\b(shopping|clothes|purchase)\b|கடைகள்/u],
  ["fun", /\b(entertainment|movie|cinema|concert)\b|பொழுதுபோக்கு/u],
  ["home", /\b(household|cleaning)\b|வீட்டுப் பொருட்கள்/u],
  ["oth", /\b(other)\b/u]
];

function parseVoiceTranscript(transcript, { members = [], currentUserId = "", now = new Date() } = {}) {
  const text = String(transcript || "").trim();
  const amountResult = amountFromTranscript(text);
  const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "";
  const isYesterday = /\byesterday\b|நேற்று/u.test(text);
  const isToday = /\btoday\b|இன்று/u.test(text);
  const occurred = isYesterday ? dateForOffset(-1, now) : isToday ? dateForOffset(0, now) : "";
  const identifiedMember = members.find(member => {
    if (!member.name || member.user_id === currentUserId) return false;
    return new RegExp(`\\b${member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  });
  const payerMention = /\b(dad|mom|father|mother|wife|husband|my partner)\b/i.test(text);
  const selfMention = /\b(i|my)\b/i.test(text) || /^(?:நான்|என்)\b/u.test(text);
  const payer = identifiedMember?.user_id || (selfMention && !payerMention ? currentUserId : "");
  const funding = /\b(personal|my own money|my pocket|own pocket)\b|சொந்தப் பணம்/u.test(text)
    ? "personal"
    : /\b(shared|household money|common fund)\b|பொதுப் பணம்/u.test(text) ? "shared" : "";

  let description = text
    .replace(amountResult ? new RegExp(amountResult.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : /$^/, " ")
    .replace(/\b(i\s+)?(spent|paid|pay|add|record|expense|for|on|in|rupees?|rs\.?|inr|today|yesterday|dad|mom|father|mother|wife|husband|my|partner|at|the)\b/gi, " ")
    .replace(/₹|ரூபாய்|எனது|செலவு|செலுத்தினேன்|இன்று|நேற்று|க்கு/gu, " ")
    .replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  if (identifiedMember) {
    description = description.replace(
      new RegExp(`\\b${identifiedMember.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"),
      ""
    ).trim();
  }
  return {
    amount: amountResult?.amount?.toString() || "",
    category,
    description: description.slice(0, 120),
    occurred,
    paid_by: payer,
    funding,
    needsPayer: payerMention && !identifiedMember
  };
}

export { parseVoiceTranscript };
