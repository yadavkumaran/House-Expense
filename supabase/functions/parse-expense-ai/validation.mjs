export const MAX_TRANSCRIPT_LENGTH = 1000;

export const BUILTIN_CATEGORIES = [
  "veg", "groc", "milk", "snk", "bill", "gas", "rent",
  "trans", "shop", "fun", "hlth", "home", "oth"
];

export function validateTranscript(text) {
  if (typeof text !== "string") return "invalid_transcript";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "empty_transcript";
  if (trimmed.length > MAX_TRANSCRIPT_LENGTH) return "transcript_too_long";
  return "";
}

export function sanitizeConfidence(val, defaultScore = 0.5) {
  const num = Number(val);
  if (!Number.isFinite(num)) return defaultScore;
  return Math.max(0, Math.min(1, Math.round(num * 100) / 100));
}

export function cleanDescriptionFromPaymentSource(text) {
  if (!text || typeof text !== "string") return "";
  let s = text.trim();
  s = s.replace(/\b(?:from\s+|using\s+)?shared\s+household(?:\s+funds?|\s+money|\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?household\s+money(?:\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?shared\s+funds?(?:\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?common\s+(?:household\s+)?funds?(?:\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?(?:my\s+)?personal\s+money(?:\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?(?:my\s+)?personal\s+(?:account|funds?)(?:\s+la)?\b/gi, " ");
  s = s.replace(/\b(?:from\s+|using\s+)?(?:my\s+)?(?:own\s+money|own\s+pocket|my\s+pocket)\b/gi, " ");
  s = s.replace(/\bpersonal\b(?!\s*care\b)(?:\s+la)?/gi, " ");
  s = s.replace(/\b(?:from\s+)?(?:veetu|veettu)\s+(?:panam|kaasu|panathula|kaasula|fund)\b/gi, " ");
  s = s.replace(/\b(?:from\s+)?sontha\s+(?:panam|kaasu|panathula|kaasula|selavu)\b/gi, " ");
  s = s.replace(/(?:என்\s*|என்னுடைய\s*)?சொந்தப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?/gu, " ");
  s = s.replace(/(?:பொதுவான\s*|பொதுப்\s*|குடும்பப்\s*)?வீட்டுப்?\s*பண(?:த்தில்|த்திலிருந்து|ம்)?/gu, " ");
  s = s.replace(/சொந்த\s*காசு|வீட்டு\s*காசு/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^(?:for|from|using|on|in|to|ku|la|at|the|a|an)\s+/i, "").trim();
  s = s.replace(/\s+(?:for|from|using|on|in|to|ku|la|at|the|a|an)$/i, "").trim();
  if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

export function validateAndSanitizeExpenses(rawExpenses, { members = [], allowedCategories = BUILTIN_CATEGORIES } = {}) {
  if (!Array.isArray(rawExpenses)) return [];

  const validMemberIds = new Set(members.map(m => m.user_id || m.id).filter(Boolean));
  const categorySet = new Set(allowedCategories);

  return rawExpenses.map(item => {
    if (!item || typeof item !== "object") return null;

    const needsClarification = Array.isArray(item.needs_clarification)
      ? item.needs_clarification.map(String)
      : [];

    // Amount validation
    let rawAmount = Number(item.amount);
    let amount = 0;
    if (Number.isFinite(rawAmount) && rawAmount > 0) {
      amount = Math.round(rawAmount * 100) / 100;
    } else {
      if (!needsClarification.includes("amount")) needsClarification.push("amount");
    }

    // Description validation
    let description = typeof item.description === "string" ? item.description.trim() : "";
    if (description) {
      description = cleanDescriptionFromPaymentSource(description);
    }
    if (description.length > 120) description = description.slice(0, 120);
    if (!description) {
      if (!needsClarification.includes("description")) needsClarification.push("description");
    }

    // Category validation
    let category = typeof item.category === "string" ? item.category.trim().toLowerCase() : "";
    if (!categorySet.has(category)) {
      category = category ? "oth" : "";
    }
    if (!category && !needsClarification.includes("category")) {
      needsClarification.push("category");
    }

    // Date validation (YYYY-MM-DD)
    let date = null;
    if (typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      date = item.date;
    }

    // Paid by validation
    let paidBy = typeof item.paid_by === "string" ? item.paid_by.trim() : null;
    if (paidBy && !validMemberIds.has(paidBy)) {
      paidBy = null;
      if (!needsClarification.includes("paid_by")) needsClarification.push("paid_by");
    }

    // Payment source validation
    let paymentSource = null;
    if (item.payment_source === "PERSONAL" || item.payment_source === "SHARED_HOUSEHOLD") {
      paymentSource = item.payment_source;
    }

    // Notes validation
    let notes = typeof item.notes === "string" ? item.notes.trim().slice(0, 200) : "";

    // Confidence scores (0.0 to 1.0)
    const conf = item.confidence || {};
    const confidence = {
      amount: sanitizeConfidence(conf.amount, amount > 0 ? 0.9 : 0.1),
      description: sanitizeConfidence(conf.description, description ? 0.85 : 0.1),
      category: sanitizeConfidence(conf.category, category ? 0.8 : 0.2),
      date: sanitizeConfidence(conf.date, date ? 0.9 : 0.5),
      paid_by: sanitizeConfidence(conf.paid_by, paidBy ? 0.9 : 0.2),
      payment_source: sanitizeConfidence(conf.payment_source, paymentSource ? 0.9 : 0.3)
    };

    return {
      description,
      amount,
      currency: "INR",
      category: category || "oth",
      date,
      notes,
      paid_by: paidBy,
      payment_source: paymentSource,
      confidence,
      needs_clarification: needsClarification
    };
  }).filter(Boolean);
}
