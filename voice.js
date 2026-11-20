const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
  lakh: 100000, lac: 100000, crore: 10000000
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
    if (value === 100 || value === 1000 || value === 100000 || value === 10000000) {
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

export const CATEGORY_PATTERNS = [
  ["veg", /\b(vegetables?|veggies?|carrot|onion|tomato|greens|potato|potatoes|brinjal|beans|cabbage|fruits?|apples?|banana|bananas?)\b|காய்கறி|தக்காளி|வெங்காயம்/ui],
  ["groc", /\b(grocer(?:y|ies)|food|supermarket|rice|dal|wheat|flour|sugar|oil|provisions?|spices?|salt|egg|eggs)\b|மளிகை|உணவு|அரிசி|பருப்பு/ui],
  ["milk", /\b(milk|dairy|curd|paneer|butter|cheese|ghee)\b|பால்|தயிர்|வெண்ணெய்|நெய்/ui],
  ["snk", /\b(snack|snacks|biscuit|biscuits|cookie|cookies|tea|coffee|bakery|sweets?)\b|தின்பண்டம்|தேநீர்|காபி/ui],
  ["rent", /\b(rent|lease|landlord|maintenance)\b|வாடகை/ui],
  ["bill", /\b(electricity|electric|current\s*bill|power\s*bill|utility|utilities|bill|bills|wifi|broadband|recharge|water\s*bill)\b|மின்சாரம்|கட்டணம்/ui],
  ["gas", /\b(cooking\s*gas|gas|cylinder|lpg|indane|bharat\s*gas|hp\s*gas)\b|எரிவாயு|சிலிண்டர்/ui],
  ["hlth", /\b(health|medical|medicine|medicines|doctor|pharmacy|clinic|hospital|tablet|tablets|syrup)\b|மருத்துவம்|மருந்து/ui],
  ["trans", /\b(transport(?:ation)?|taxi|uber|ola|bus|train|petrol|fuel|diesel|auto|cab|fare|metro|parking|toll)\b|போக்குவரத்து|பெட்ரோல்|டீசல்/ui],
  ["shop", /\b(shopping|clothes|clothing|shirt|shirts|pant|pants|dress|shoes|flipkart|amazon|myntra)\b|கடைகள்|துணி/ui],
  ["fun", /\b(entertainment|movie|cinema|concert|film|theatre|outing|party)\b|பொழுதுபோக்கு|திரைப்படம்|படம்/ui],
  ["home", /\b(household|cleaning|decor|furniture|soap|detergent|repair|repairs|plumbing)\b|வீட்டுப் பொருட்கள்/ui],
  ["oth", /\b(other|misc|miscellaneous)\b|மற்றவை/ui]
];

function isTimeOrQuantityContext(before, after) {
  // Reject times like "at 6", "6 pm", "6 am", "at 6 today"
  if (/(?:^|\s)at$/i.test(before) && /^(?:today|yesterday|tomorrow|am|pm|o'clock|\.\s*today|\.\s*$)/i.test(after)) return true;
  if (/^(?:am|pm|o'clock|hours?|mins?|minutes?|seconds?)\b/i.test(after)) return true;
  // Reject quantities like "1 kg", "2 litres", "5 packets"
  if (/^(?:kg|kgs?|kilo|kilos?|gm|gms?|grams?|l|liters?|litres?|ml|packets?|pieces?|box(?:es)?)\b/i.test(after)) return true;
  return false;
}

function parseMultiItems(transcript) {
  // Matches segments like "Vegetables 150, fruits 100" or "Vegetables 150 and fruits 100"
  const itemRegex = /([a-zA-Z\u0B80-\u0BFF\s]+?)\s*(?:for|cost|costs|:)?\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|ரூபாய்)?(?=[,;&]|\s+and\s+|\s*\.|\s*$)/gi;
  const items = [];
  let match;
  while ((match = itemRegex.exec(transcript)) !== null) {
    const rawLabel = match[1].trim();
    const cleanLabel = rawLabel.replace(/^(?:and|plus|also|i\s+spent|we\s+spent|paid|bought)\s+/i, "").trim();
    const val = Number(match[2].replaceAll(",", ""));
    if (cleanLabel && Number.isFinite(val) && val > 0 && !/^(?:at|the|for|on|in)$/i.test(cleanLabel)) {
      items.push({ label: cleanLabel, amount: val, raw: match[0] });
    }
  }
  return items.length >= 2 ? items : null;
}

function amountFromTranscript(transcript) {
  // 1. Currency tagged amount (₹250, 250 rupees, 250 rs, etc.)
  const currencyAmount = transcript.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)(?:\s*rupees?)?|\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|ரூபாய்)\b/i);
  if (currencyAmount) {
    const amount = Number((currencyAmount[1] || currencyAmount[2]).replaceAll(",", ""));
    return Number.isFinite(amount) && amount > 0 ? { amount, match: currencyAmount[0] } : null;
  }

  // 2. Check for multi-item dictations ("Vegetables 150, fruits 100")
  const multi = parseMultiItems(transcript);
  if (multi) {
    const total = multi.reduce((sum, item) => sum + item.amount, 0);
    return {
      amount: total,
      match: multi.map(m => m.raw).join(", "),
      isMulti: true,
      items: multi
    };
  }

  // 3. Bare numeric amounts in natural statements ("Milk 60", "Vegetables 150", "Paid 120 for petrol")
  const numberRegex = /\b(\d[\d,]*(?:\.\d{1,2})?)\b/g;
  let numMatch;
  while ((numMatch = numberRegex.exec(transcript)) !== null) {
    const amountStr = numMatch[1];
    const amountVal = Number(amountStr.replaceAll(",", ""));
    const offset = numMatch.index;
    const before = transcript.slice(0, offset).trimEnd();
    const after = transcript.slice(offset + amountStr.length).trimStart();

    if (amountVal <= 0) continue;
    if (isTimeOrQuantityContext(before, after)) continue;

    // Check if preceded by expense verbs or item noun
    const expenseVerbBefore = /(?:spent|paid|pay|add|record|bought(?:\s+[\p{L}\p{M}\s]+)?\s+for|cost|costs)$/i.test(before);
    const categoryOrNounBefore = CATEGORY_PATTERNS.some(([, pat]) => pat.test(before));
    const nounPhraseBefore = /[\p{L}\p{M}]{2,}$/u.test(before) && !/(?:at|in|on|the|a|an|of)$/i.test(before);

    if (expenseVerbBefore || categoryOrNounBefore || (nounPhraseBefore && before.length > 0)) {
      return { amount: amountVal, match: amountStr };
    }
  }

  // 4. Spoken number words ("eight hundred rupees", "இருநூறு ரூபாய்")
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

function parseVoiceTranscript(transcript, { members = [], currentUserId = "", now = new Date() } = {}) {
  const text = String(transcript || "").trim();
  const amountResult = amountFromTranscript(text);
  const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "";
  const isYesterday = /\byesterday\b|நேற்று/ui.test(text);
  const isToday = /\btoday\b|இன்று/ui.test(text);
  const occurred = isYesterday ? dateForOffset(-1, now) : isToday ? dateForOffset(0, now) : "";

  const identifiedMember = members.find(member => {
    if (!member.name || member.user_id === currentUserId) return false;
    return new RegExp(`\\b${member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  });
  const payerMention = /\b(dad|mom|father|mother|wife|husband|my partner)\b/i.test(text);
  const selfMention = /\b(i|my|we)\b/i.test(text) || /^(?:நான்|என்)\b/u.test(text);
  const payer = identifiedMember?.user_id || (selfMention && !payerMention ? currentUserId : "");
  const funding = /\b(personal|my own money|my pocket|own pocket)\b|சொந்தப் பணம்/ui.test(text)
    ? "personal"
    : /\b(shared|household money|common fund)\b|பொதுப் பணம்/ui.test(text) ? "shared" : "";

  let description = "";
  let notes = "";

  if (amountResult?.isMulti && amountResult.items) {
    description = amountResult.items.map(i => i.label).join(", ");
    notes = amountResult.items.map(i => `${i.label}: ₹${i.amount}`).join(", ");
  } else {
    description = text
      .replace(amountResult ? new RegExp(amountResult.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : /$^/, " ")
      .replace(/\b(i|we|my)?\s*(spent|paid|pay|add|record|bought|expense|for|on|in|rupees?|rs\.?|inr|today|yesterday|dad|mom|father|mother|wife|husband|partner|at|the|a|an)\b/gi, " ")
      .replace(/₹|ரூபாய்|எனது|செலவு|செலுத்தினேன்|இன்று|நேற்று|க்கு/gu, " ")
      .replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();

    // Clean up leading filler words like "we"
    description = description.replace(/^(?:we|i|my)\s+/i, "").trim();

    if (identifiedMember) {
      description = description.replace(
        new RegExp(`\\b${identifiedMember.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"),
        ""
      ).trim();
    }
  }

  // Capitalize description nicely
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    amount: amountResult?.amount != null ? amountResult.amount.toString() : "",
    category,
    description: description.slice(0, 120),
    occurred,
    paid_by: payer,
    funding,
    notes: notes.slice(0, 150),
    needsPayer: payerMention && !identifiedMember
  };
}

export { parseVoiceTranscript };
