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

const TANGLISH_NUMBERS = {
  ambadhu: 50, ambathu: 50, aruvadhu: 60, aruvathu: 60, ezhubadhu: 70, ezhubathu: 70,
  enbadhu: 80, enbathu: 80, thollayiram: 900, nooru: 100, irunooru: 200, munnooru: 300,
  nanooru: 400, ainnooru: 500, ainooru: 500, arunooru: 600, ezhunooru: 700, ennooru: 800,
  ayiram: 1000, rendu: 2, moonu: 3, naalu: 4, anju: 5, aaru: 6, ezhu: 7, ettu: 8,
  ombodhu: 9, onpathu: 9, pathu: 10, irubadhu: 20, irubathu: 20, muppadhu: 30, muppathu: 30,
  naappadhu: 40, naappathu: 40
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
    const value = NUMBER_WORDS[word] ?? TAMIL_NUMBERS[word] ?? TANGLISH_NUMBERS[word];
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
  ["veg", /\b(vegetables?|veggies?|carrot|onion|tomato|greens|potato|potatoes|brinjal|beans|cabbage|fruits?|apples?|banana|bananas?|kaaikari|kaikarigal)\b|காய்கறி(?:கள்)?|தக்காளி|வெங்காயம்|பழங்கள்/ui],
  ["groc", /\b(grocer(?:y|ies)|food|supermarket|rice|dal|wheat|flour|sugar|oil|provisions?|spices?|salt|egg|eggs|dosa(?:\s*batter)?|briyani|biryani|lunch|dinner|meals|hotel|restaurant)\b|மளிகை(?:\s*பொருட்கள்)?|உணவு|அரிசி|பருப்பு/ui],
  ["milk", /\b(milk|dairy|curd|paneer|butter|cheese|ghee|paal|thayir)\b|பால்|தயிர்|வெண்ணெய்|நெய்/ui],
  ["snk", /\b(snack|snacks|biscuit|biscuits|cookie|cookies|tea|coffee|bakery|sweets?|samosa|tiffin)\b|தின்பண்ட(?:ம்|ங்கள்)?|தேநீர்|டீ|காபி|சிற்றுண்டி/ui],
  ["rent", /\b(rent|lease|landlord|maintenance)\b|வாடகை/ui],
  ["bill", /\b(electricity|electric|current\s*bill|power\s*bill|utility|utilities|bill|bills|wifi|broadband|recharge|water\s*bill)\b|மின்சாரம்|மின்சார(?:\s*கட்டணம்)?|கட்டணம்/ui],
  ["gas", /\b(cooking\s*gas|gas|cylinder|lpg|indane|bharat\s*gas|hp\s*gas)\b|எரிவாயு|சிலிண்டர்/ui],
  ["hlth", /\b(health|medical|medicine|medicines|doctor|pharmacy|clinic|hospital|tablet|tablets|syrup|bandaid)\b|மருத்துவம்|மருந்து/ui],
  ["trans", /\b(transport(?:ation)?|taxi|uber|ola|bus|train|petrol|fuel|diesel|auto|cab|fare|metro|parking|toll)\b|போக்குவரத்து|பெட்ரோல்|டீசல்/ui],
  ["shop", /\b(shopping|clothes|clothing|shirt|shirts|pant|pants|dress|shoes|flipkart|amazon|myntra)\b|கடைகள்|துணி/ui],
  ["fun", /\b(entertainment|movie|cinema|concert|film|theatre|outing|party)\b|பொழுதுபோக்கு|திரைப்படம்|படம்/ui],
  ["home", /\b(household|cleaning|decor|furniture|soap|detergent|repair|repairs|plumbing)\b|வீட்டுப் பொருட்கள்/ui],
  ["oth", /\b(other|misc|miscellaneous)\b|மற்றவை/ui]
];

export function detectCategory(text) {
  if (!text) return "";
  const found = CATEGORY_PATTERNS.find(([, pat]) => pat.test(text));
  return found ? found[0] : "";
}

function isTimeOrQuantityContext(before, after) {
  if (/(?:^|\s)at$/i.test(before) && /^(?:today|yesterday|tomorrow|am|pm|o'clock|\.\s*today|\.\s*$)/i.test(after)) return true;
  if (/^(?:am|pm|o'clock|hours?|mins?|minutes?|seconds?)\b/i.test(after)) return true;
  if (/^(?:kg|kgs?|kilo|kilos?|gm|gms?|grams?|l|liters?|litres?|ml|packets?|pieces?|box(?:es)?)\b/i.test(after)) return true;
  return false;
}

export function parseMultiItems(transcript) {
  // Matches multi-item statements like:
  // "Today I bought milk for 60, vegetables for 150 and fruits for 100"
  // "Vegetables 150 and fruits 100"
  // "Bought rice 500 rupees, oil 200 rupees and sugar 50 rupees"
  // "இன்று காய்கறி 150 மற்றும் பழங்கள் 100 வாங்கினேன்."
  // "பால் 60 ரூபாய் மற்றும் தயிர் 30 ரூபாய்."

  const items = [];

  // Match English / Tanglish / Tamil patterns with conjunctions or commas
  const multiRegex = /(?:^|[,;&]|\s+and\s+|\s+மற்றும்\s+)\s*(?:today\s+)?(?:i\s+bought\s+|we\s+spent\s+|bought\s+|paid\s+)?([a-zA-Z\u0B80-\u0BFF\s]+?)\s*(?:for|cost|costs|:)?\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|ruba(?:i)?|rooba(?:i)?|ரூபாய்|ரூபாய்க்கு)?(?=[,;&]|\s+and\s+|\s+மற்றும்\s+|\s*\.|\s*$)/gi;

  let match;
  while ((match = multiRegex.exec(transcript)) !== null) {
    let rawLabel = match[1].trim();
    rawLabel = rawLabel.replace(/^(?:today\s+|yesterday\s+)?(?:i\s+bought|we\s+spent|i\s+spent|paid|bought|spent|also|and|plus|மற்றும்|வாங்கினேன்|வாங்கியது)\s+/i, "").trim();
    rawLabel = rawLabel.replace(/\s+(?:for|on|costs?)$/i, "").trim();

    const val = Number(match[2].replaceAll(",", ""));
    if (rawLabel && Number.isFinite(val) && val > 0 && !/^(?:at|the|for|on|in|today|yesterday)$/i.test(rawLabel)) {
      items.push({ label: rawLabel, amount: val, raw: match[0].trim() });
    }
  }

  return items.length >= 2 ? items : null;
}

function handleSpokenCorrection(text) {
  // "Vegetables 150 wait no 180 rupees" -> amount 180, cleaned text "Vegetables 180 rupees"
  const correctionMatch = text.match(/(?:wait\s+no|no\s+wait|sorry|wait|no\s+not)\s+(?:no\s+)?(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|ruba(?:i)?|rooba(?:i)?|ரூபாய்|ரூபாய்க்கு)?/i);
  if (correctionMatch) {
    const correctedAmount = Number(correctionMatch[1].replaceAll(",", ""));
    const cleanedText = text.replace(/\d[\d,]*(?:\.\d{1,2})?\s*(?:wait\s+no|no\s+wait|sorry|wait|no\s+not)\s+(?:no\s+)?/i, "");
    return { correctedAmount, cleanedText };
  }
  return null;
}

function amountFromTranscript(transcript) {
  // 1. Spoken correction check
  const correction = handleSpokenCorrection(transcript);
  if (correction && Number.isFinite(correction.correctedAmount) && correction.correctedAmount > 0) {
    return { amount: correction.correctedAmount, match: String(correction.correctedAmount) };
  }

  // 2. Currency tagged amount (₹250, 250 rupees, 250 rs, 250 ruba, 60 ரூபாய்க்கு, etc.)
  const currencyAmount = transcript.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(?:rupees?|ruba(?:i)?|rooba(?:i)?))?|\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|inr|ruba(?:i)?|rooba(?:i)?|ரூபாய்|ரூபாய்க்கு)\b|(\d[\d,]*(?:\.\d{1,2})?)(?:ரூபாய்|ரூபாய்க்கு)/i);
  if (currencyAmount) {
    const amount = Number((currencyAmount[1] || currencyAmount[2] || currencyAmount[3]).replaceAll(",", ""));
    if (Number.isFinite(amount) && amount > 0) {
      return { amount, match: currencyAmount[0] };
    }
  }

  // 3. Multi-item dictations ("Vegetables 150, fruits 100")
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

  // 4. Bare numeric amounts in natural statements ("Milk 60", "Vegetables 150", "Paid 120 for petrol")
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

    const expenseVerbBefore = /(?:spent|paid|pay|add|record|bought(?:\s+[\p{L}\p{M}\s]+)?\s+for|cost|costs)$/i.test(before);
    const categoryOrNounBefore = CATEGORY_PATTERNS.some(([, pat]) => pat.test(before));
    const nounPhraseBefore = /[\p{L}\p{M}]{2,}$/u.test(before) && !/(?:at|in|on|the|a|an|of)$/i.test(before);

    if (expenseVerbBefore || categoryOrNounBefore || (nounPhraseBefore && before.length > 0)) {
      return { amount: amountVal, match: amountStr };
    }
  }

  // 5. Spoken number words ("eight hundred rupees", "இருநூறு ரூபாய்", "ambadhu rupees", "nooru ruba")
  const words = transcript.toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
  const starts = words.map((word, index) =>
    NUMBER_WORDS[word] != null || TAMIL_NUMBERS[word] != null || TANGLISH_NUMBERS[word] != null ? index : -1
  ).filter(index => index >= 0);

  for (const start of starts) {
    const sequence = [];
    for (const word of words.slice(start)) {
      if (NUMBER_WORDS[word] == null && TAMIL_NUMBERS[word] == null && TANGLISH_NUMBERS[word] == null && word !== "and") break;
      sequence.push(word);
    }
    const amount = wordsToNumber(sequence);
    const end = start + sequence.length;
    const currencyFollows = /^(rupees?|rs|inr|ruba|rubai|rooba|roobai|ரூபாய்|ரூபாய்க்கு)$/.test(words[end] || "");
    const expenseVerbBefore = /^(spent|paid|pay|add|record|vanginen|poten|kattinen|selavu)$/.test(words[start - 1] || "") ||
      /^(spent|paid|pay|add|record)$/.test(words[start - 2] || "");
    const amountPhraseBeforeItem = amount >= 10 && expenseVerbBefore && /^(for|on|at|to|ku)$/.test(words[end] || "");

    if (amount > 0 && (currencyFollows || amountPhraseBeforeItem || sequence.length > 1)) {
      return { amount, match: sequence.join(" ") };
    }
  }

  return null;
}

function dateForOffset(offset, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const FAMILY_ALIASES = [
  { key: "dad", match: /\b(?:dad|father|appa|engappa)\b/i, tamil: /(?:^|[\s.,!?])(?:அப்பா|தந்தை)(?:[\s.,!?]|$)/u, names: ["dad", "father", "appa", "engappa", "அப்பா", "தந்தை"] },
  { key: "mom", match: /\b(?:mom|mother|amma|engamma)\b/i, tamil: /(?:^|[\s.,!?])(?:அம்மா|தாய்)(?:[\s.,!?]|$)/u, names: ["mom", "mother", "amma", "engamma", "அம்மா", "தாய்"] },
  { key: "brother", match: /\b(?:brother|bro|anna|thambi)\b/i, tamil: /(?:^|[\s.,!?])(?:அண்ணன்|தம்பி)(?:[\s.,!?]|$)/u, names: ["brother", "bro", "anna", "thambi", "அண்ணன்", "தம்பி"] },
  { key: "sister", match: /\b(?:sister|sis|akka|thangai)\b/i, tamil: /(?:^|[\s.,!?])(?:அக்கா|தங்கை)(?:[\s.,!?]|$)/u, names: ["sister", "sis", "akka", "thangai", "அக்கா", "தங்கை"] },
  { key: "husband", match: /\b(?:husband|hubby)\b/i, tamil: /(?:^|[\s.,!?])(?:கணவர்|வீட்டுக்காரர்)(?:[\s.,!?]|$)/u, names: ["husband", "கணவர்", "வீட்டுக்காரர்"] },
  { key: "wife", match: /\b(?:wife)\b/i, tamil: /(?:^|[\s.,!?])(?:மனைவி|மனைவியார்)(?:[\s.,!?]|$)/u, names: ["wife", "மனைவி", "மனைவியார்"] }
];

export function parseVoiceTranscript(transcript, { members = [], memberAliases = [], aliases = [], currentUserId = "", now = new Date() } = {}) {
  const text = String(transcript || "").trim();

  // Casual chatter filter (e.g. "Hello good morning how are you", "Just checking the app")
  if (/^(?:hello|hi|good\s+morning|good\s+evening|how\s+are\s+you|just\s+checking(?:\s+the\s+app)?|testing(?:\s+1\s+2\s+3)?)[.!?\s]*$/i.test(text)) {
    return {
      expenses: [],
      amount: "",
      category: "",
      description: "",
      occurred: "",
      paid_by: "",
      payment_source: "",
      funding: "",
      notes: "",
      needsPayer: false
    };
  }

  const allAliases = [...memberAliases, ...aliases];
  const isYesterday = /\byesterday\b|நேற்று/ui.test(text);
  const isToday = /\btoday\b|இன்று/ui.test(text);
  const occurred = isYesterday ? dateForOffset(-1, now) : isToday ? dateForOffset(0, now) : "";

  // 1. Payer identification
  let identifiedMember = null;

  // Check custom household member aliases first
  for (const customAlias of allAliases) {
    if (customAlias.alias && customAlias.user_id) {
      const aliasPattern = new RegExp(`(?:^|[\\s.,!?])${customAlias.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s.,!?]|$)`, "i");
      if (aliasPattern.test(text)) {
        identifiedMember = members.find(m => (m.user_id || m.id) === customAlias.user_id) || { user_id: customAlias.user_id, name: customAlias.alias };
        break;
      }
    }
  }

  // Check exact member name
  if (!identifiedMember) {
    identifiedMember = members.find(member => {
      if (!member.name || (member.user_id || member.id) === currentUserId) return false;
      return new RegExp(`(?:^|[\\s.,!?])${member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[\\s.,!?]|$)`, "i").test(text);
    });
  }

  // Check built-in family alias groups (Dad, Mom, etc.)
  let aliasMentioned = false;
  let genericPayerWord = "";
  if (!identifiedMember) {
    for (const alias of FAMILY_ALIASES) {
      if (alias.match.test(text) || alias.tamil.test(text)) {
        aliasMentioned = true;
        genericPayerWord = alias.key;
        const matchingMembers = members.filter(m => {
          const mName = (m.name || "").toLowerCase();
          return alias.names.some(n => mName.includes(n.toLowerCase()));
        });
        if (matchingMembers.length === 1) {
          identifiedMember = matchingMembers[0];
          break;
        }
      }
    }
  }

  const payerMention = aliasMentioned || /\b(dad|mom|father|mother|brother|sister|wife|husband|my partner|friend)\b/i.test(text) || /(?:^|[\s.,!?])(?:அப்பா|அம்மா|கணவர்|மனைவி|தந்தை|தாய்)(?:[\s.,!?]|$)/u.test(text);
  const selfMention = /\b(i|my|mine|naan|nan|en|enakku|ennoda|ennudaiya|kuduthen|poten|kattinen|vanginen|sapten|pannen)\b/i.test(text) || /(?:^|[\s.,!?])(?:நான்|என்னுடைய|என்|எனது|வாங்கினேன்|செலுத்தினேன்|போட்டேன்|கொடுத்தேன்|செய்தேன்|கட்டினேன்)(?:[\s.,!?]|$)/u.test(text);

  let payer = "";
  let needsPayer = false;
  if (identifiedMember) {
    payer = identifiedMember.user_id || identifiedMember.id;
  } else if (payerMention) {
    needsPayer = true;
    payer = "";
  } else if (selfMention) {
    payer = currentUserId;
  }

  // 2. Payment source: PERSONAL vs SHARED_HOUSEHOLD
  const PERSONAL_REGEX = /\b(?:personal|personal\s+money|personal\s+la|my\s+own\s+money|own\s+money|my\s+pocket|own\s+pocket|from\s+my\s+pocket|from\s+my\s+personal\s+money|using\s+my\s+personal\s+money|sontha\s+panam|sontha\s+kaasu|sontha\s+panathula|sontha\s+kaasula|sontha\s+selavu)\b|சொந்த\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|சொந்தப்\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|என்\s*சொந்த\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|என்னுடைய\s*சொந்த\s*பண(?:த்தில்|த்திலிருந்து|ம்)?/ui;
  const SHARED_REGEX = /\b(?:shared|shared\s+funds?|shared\s+la|household\s+money|household\s+fund|veetu\s+panam|veetu\s+kaasu|veetu\s+panathula|veetu\s+kaasula|veetu\s+fund|common\s+fund|common\s+household\s+fund|household\s+funds?|shared\s+money|from\s+shared\s+funds?|from\s+household\s+money|common\s+account)\b|வீட்டுப்\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|வீட்டு\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|பொதுவான\s*வீட்டுப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|பொதுப்\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|குடும்பப்\s*பண(?:த்தில்|த்திலிருந்து|ம்)?/ui;

  let payment_source = "";
  let funding = "";
  if (PERSONAL_REGEX.test(text)) {
    payment_source = "PERSONAL";
    funding = "personal";
  } else if (SHARED_REGEX.test(text)) {
    payment_source = "SHARED_HOUSEHOLD";
    funding = "shared";
  }

  // 3. Multi-item statements detection
  const multiItems = parseMultiItems(text);
  if (multiItems && multiItems.length >= 2) {
    const expenses = multiItems.map(item => {
      const cat = detectCategory(item.label);
      return {
        description: item.label.charAt(0).toUpperCase() + item.label.slice(1),
        amount: item.amount,
        currency: "INR",
        category: cat,
        date: occurred || null,
        notes: "",
        paid_by: payer || null,
        payment_source: payment_source || (funding === "shared" ? "SHARED_HOUSEHOLD" : "PERSONAL"),
        confidence: {
          amount: 0.95,
          description: 0.9,
          category: cat !== "oth" ? 0.85 : 0.5,
          date: occurred ? 0.95 : 0.5,
          paid_by: payer ? 0.9 : 0.3,
          payment_source: payment_source ? 0.9 : 0.5
        },
        needs_clarification: needsPayer ? ["paid_by"] : []
      };
    });

    const totalAmount = multiItems.reduce((sum, item) => sum + item.amount, 0);
    const combinedDesc = multiItems.map(i => i.label).join(", ");
    const combinedNotes = multiItems.map(i => `${i.label}: ₹${i.amount}`).join(", ");

    return {
      expenses,
      amount: String(totalAmount),
      category: expenses[0]?.category || "veg",
      description: combinedDesc,
      occurred,
      paid_by: payer,
      payment_source,
      funding,
      notes: combinedNotes,
      needsPayer
    };
  }

  // 4. Single item parsing
  const amountResult = amountFromTranscript(text);
  let category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || "";

  let description = "";
  const needsClarification = [];

  if (amountResult?.amount) {
    // Clean description from text
    let clean = text;

    // Handle spoken correction in text
    clean = clean.replace(/\d[\d,]*(?:\.\d{1,2})?\s*(?:wait\s+no|no\s+wait|sorry|wait|no\s+not)\s+(?:no\s+)?/gi, " ");

    clean = clean
      .replace(new RegExp(amountResult.match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
      .replace(/\b(?:using\s+my\s+personal\s+money|from\s+household\s+money|from\s+shared\s+funds?|personal\s+money|household\s+money|shared\s+funds?|common\s+funds?|own\s+money|my\s+personal\s+money|veetu\s+panathula|veetu\s+kaasula|sontha\s+panathula|sontha\s+kaasula|veetu\s+panam|sontha\s+panam|personal\s+money\s+la)\b/gi, " ")
      .replace(/பொதுவான\s*வீட்டுப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|வீட்டுப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|சொந்தப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?|குடும்பப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?/gu, " ")
      .replace(/\b(i|we|my|naan|nan|en|enakku|ennoda)?\s*(spent|paid|pay|add|record|bought|expense|for|on|in|using|from|rupees?|rs\.?|inr|ruba(?:i)?|rooba(?:i)?|today|yesterday|dad|mom|father|mother|wife|husband|partner|brother|sister|at|the|a|an|ku|la|vanginen|vanginar|vanginaru|vanganga|kattinen|poten)\b/gi, " ")
      .replace(/₹|ரூபாய்க்கு|ரூபாய்|எனது|என்னுடைய|நான்|செலவு|செலுத்தினேன்|செலுத்தினார்|செலுத்தினாங்க|வாங்கினேன்|வாங்கினார்|வாங்கினாங்க|வாங்கினார்கள்|இன்று|நேற்று|க்கு/gu, " ")
      .replace(/அப்பா|அம்மா|கணவர்|மனைவி|தந்தை|தாய்/gu, " ")
      .replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();

    clean = clean.replace(/^(?:we|i|my|for|from|to|ku|la|naan)\s+/i, "").trim();

    if (identifiedMember) {
      clean = clean.replace(new RegExp(`\\b${identifiedMember.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), "").trim();
    }

    description = clean.replace(/\s+/g, " ").trim();
  }

  // Ambiguous statement check (e.g. "I spent 200")
  if (!description && amountResult?.amount) {
    category = "";
    needsClarification.push("description");
    needsClarification.push("category");
  } else if (!category) {
    category = detectCategory(description);
    if (!category) {
      needsClarification.push("category");
    }
  }

  if (amountResult?.amount == null || amountResult.amount <= 0) {
    needsClarification.push("amount");
  }

  if (needsPayer) {
    needsClarification.push("paid_by");
  }

  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  const singleExpense = {
    description: description.slice(0, 120),
    amount: amountResult?.amount != null ? amountResult.amount : 0,
    currency: "INR",
    category: category || "",
    date: occurred || null,
    notes: "",
    paid_by: payer || null,
    payment_source: payment_source || null,
    confidence: {
      amount: amountResult?.amount ? 0.95 : 0.1,
      description: description ? 0.85 : 0.1,
      category: category ? 0.8 : 0.2,
      date: occurred ? 0.9 : 0.5,
      paid_by: payer ? 0.9 : (needsPayer ? 0.2 : 0.5),
      payment_source: payment_source ? 0.9 : 0.4
    },
    needs_clarification: needsClarification
  };

  return {
    expenses: [singleExpense],
    amount: amountResult?.amount != null ? amountResult.amount.toString() : "",
    category: category || "",
    description: description.slice(0, 120),
    occurred,
    paid_by: payer,
    payment_source,
    funding,
    notes: "",
    needsPayer
  };
}
