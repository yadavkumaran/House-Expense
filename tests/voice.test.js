import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseTranscriptionEndpoint, parseVoiceTranscript, transcriptionFailureKey } from "../voice.js";

const fixedDate = new Date(2026, 9, 17);

test("classifies the deployed Supabase gateway's missing-function response as a deployment error", () => {
  assert.equal(transcriptionFailureKey(404, "NOT_FOUND"), "voiceFunctionNotDeployed");
  assert.equal(transcriptionFailureKey(404), "voiceFunctionNotDeployed");
  assert.equal(transcriptionFailureKey(401, "unauthorized"), "voiceSessionExpired");
  assert.equal(transcriptionFailureKey(429, "rate_limited"), "voiceRateLimited");
  assert.equal(transcriptionFailureKey(415, "invalid_audio"), "voiceInvalidAudio");
  assert.equal(transcriptionFailureKey(503, "provider_not_configured"), "voiceProviderNotConfigured");
  assert.equal(transcriptionFailureKey(429, "provider_rate_limited"), "voiceProviderRateLimited");
  assert.equal(transcriptionFailureKey(504, "provider_timeout"), "voiceTimeout");
  assert.equal(transcriptionFailureKey(502, "provider_network_error"), "voiceProviderNetworkError");
  assert.equal(transcriptionFailureKey(502, "provider_error"), "voiceProviderError");
  assert.equal(transcriptionFailureKey(400, "invalid_request"), "voiceRequestError");
});

test("diagnoses missing, CORS-blocked, and unreachable transcription endpoints separately", async () => {
  const endpoint = "https://project.example/functions/v1/transcribe-expense";
  const calls = [];
  const missing = await diagnoseTranscriptionEndpoint(endpoint, async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ code: "NOT_FOUND" }), { status: 404 });
  });
  assert.equal(missing, "voiceFunctionNotDeployed");
  assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].options.method, "GET");
  assert.equal("headers" in calls[0].options, false);

  assert.equal(
    await diagnoseTranscriptionEndpoint(endpoint, async () => new Response("Method not allowed", { status: 405 })),
    "voiceRequestBlocked"
  );
  assert.equal(
    await diagnoseTranscriptionEndpoint(endpoint, async () => { throw new TypeError("network offline"); }),
    "voiceNetworkError"
  );
});

test("parses a numeric English expense and retains its spoken description", () => {
  const draft = parseVoiceTranscript("I spent 250 rupees on groceries today.", { currentUserId: "me", now: fixedDate });
  assert.equal(draft.amount, "250");
  assert.equal(draft.category, "groc");
  assert.match(draft.description, /groceries/i);
  assert.equal(draft.occurred, "2026-10-17");
  assert.equal(draft.paid_by, "me");
  assert.equal(draft.funding, "");
});

test("parses a spoken English number, category and relative date", () => {
  const draft = parseVoiceTranscript("Paid eight hundred rupees for electricity yesterday.", { now: fixedDate });
  assert.equal(draft.amount, "800");
  assert.equal(draft.category, "bill");
  assert.match(draft.description, /electricity/i);
  assert.equal(draft.occurred, "2026-10-16");
  assert.equal(draft.paid_by, "");
});

test("parses the requested household dictation examples without guessing unspecified fields", () => {
  const groceries = parseVoiceTranscript("I spent 250 rupees on groceries today.", { currentUserId: "me", now: fixedDate });
  assert.equal(groceries.amount, "250");
  assert.equal(groceries.category, "groc");
  assert.equal(groceries.occurred, "2026-10-17");
  assert.equal(groceries.paid_by, "me");

  const electricity = parseVoiceTranscript("Paid 800 rupees for electricity yesterday.", { now: fixedDate });
  assert.equal(electricity.amount, "800");
  assert.equal(electricity.category, "bill");
  assert.equal(electricity.occurred, "2026-10-16");
  assert.equal(electricity.paid_by, "");

  const milk = parseVoiceTranscript("Add 120 rupees for milk.", { now: fixedDate });
  assert.equal(milk.amount, "120");
  assert.equal(milk.category, "milk");
  assert.equal(milk.occurred, "");

  const vegetables = parseVoiceTranscript("Dad paid 500 rupees for vegetables.", {
    members: [{ user_id: "dad", name: "Dad" }], now: fixedDate
  });
  assert.equal(vegetables.amount, "500");
  assert.equal(vegetables.paid_by, "dad");
  assert.equal(vegetables.funding, "");

  const petrol = parseVoiceTranscript("I spent 150 rupees on petrol.", { currentUserId: "me", now: fixedDate });
  assert.equal(petrol.amount, "150");
  assert.equal(petrol.category, "trans");
  assert.equal(petrol.paid_by, "me");
});

test("maps transportation, rent, shopping and entertainment to distinct categories", () => {
  assert.equal(parseVoiceTranscript("I spent 150 rupees on petrol.", { now: fixedDate }).category, "trans");
  assert.equal(parseVoiceTranscript("Paid 900 rupees for rent.", { now: fixedDate }).category, "rent");
  assert.equal(parseVoiceTranscript("Spent 300 on shopping.", { now: fixedDate }).category, "shop");
  assert.equal(parseVoiceTranscript("Paid 500 for a movie.", { now: fixedDate }).category, "fun");
});

test("uses an identified household member as payer without inferring funding", () => {
  const draft = parseVoiceTranscript("Dad paid 500 rupees for vegetables.", {
    currentUserId: "me", members: [{ user_id: "dad-id", name: "Dad" }], now: fixedDate
  });
  assert.equal(draft.paid_by, "dad-id");
  assert.equal(draft.needsPayer, false);
  assert.equal(draft.category, "veg");
  assert.equal(draft.funding, "");
});

test("does not invent a payer when a role is mentioned but cannot be matched", () => {
  const draft = parseVoiceTranscript("Dad paid 500 rupees for vegetables.", { currentUserId: "me", now: fixedDate });
  assert.equal(draft.paid_by, "");
  assert.equal(draft.needsPayer, true);
});

test("leaves missing and zero amounts for manual review", () => {
  assert.equal(parseVoiceTranscript("Add groceries for the house.", { now: fixedDate }).amount, "");
  assert.equal(parseVoiceTranscript("I spent 0 rupees on milk.", { now: fixedDate }).amount, "");
  assert.equal(parseVoiceTranscript("Add one milk for the house.", { now: fixedDate }).amount, "");
  assert.equal(parseVoiceTranscript("Paid the electricity bill at 6 today.", { now: fixedDate }).amount, "");
});

test("accepts a contextual amount without currency but not unrelated numbers", () => {
  assert.equal(parseVoiceTranscript("I spent 150 on petrol.", { now: fixedDate }).amount, "150");
  assert.equal(parseVoiceTranscript("I spent 150 rupees on petrol.", { now: fixedDate }).amount, "150");
});

test("does not invent missing dates, categories, payers, or funding sources", () => {
  const draft = parseVoiceTranscript("Paid 120 rupees for a local item.", { now: fixedDate });
  assert.equal(draft.occurred, "");
  assert.equal(draft.category, "");
  assert.equal(draft.paid_by, "");
  assert.equal(draft.funding, "");
});

test("uses only explicitly stated self payer and funding details", () => {
  const draft = parseVoiceTranscript("I spent 150 rupees on petrol using my personal pocket today.", {
    currentUserId: "me", now: fixedDate
  });
  assert.equal(draft.paid_by, "me");
  assert.equal(draft.funding, "personal");
  assert.equal(draft.occurred, "2026-10-17");
});

test("parses supported Tamil numeric and spoken-number transcripts", () => {
  assert.equal(parseVoiceTranscript("மளிகை 250 ரூபாய்", { now: fixedDate }).category, "groc");
  assert.equal(parseVoiceTranscript("இருநூறு ரூபாய் காய்கறி", { now: fixedDate }).amount, "200");
  assert.equal(parseVoiceTranscript("இரண்டு நூறு ரூபாய் காய்கறி", { now: fixedDate }).amount, "200");
});

test("parses all required natural household voice commands", () => {
  // 1. "I spent 250 rupees for vegetables today."
  const t1 = parseVoiceTranscript("I spent 250 rupees for vegetables today.", { currentUserId: "me", now: fixedDate });
  assert.equal(t1.amount, "250");
  assert.equal(t1.category, "veg");
  assert.match(t1.description, /vegetables/i);
  assert.equal(t1.occurred, "2026-10-17");
  assert.equal(t1.paid_by, "me");

  // 2. "Milk 60 rupees."
  const t2 = parseVoiceTranscript("Milk 60 rupees.", { now: fixedDate });
  assert.equal(t2.amount, "60");
  assert.equal(t2.category, "milk");
  assert.match(t2.description, /milk/i);

  // 3. "Yesterday we spent 500 rupees for groceries."
  const t3 = parseVoiceTranscript("Yesterday we spent 500 rupees for groceries.", { currentUserId: "me", now: fixedDate });
  assert.equal(t3.amount, "500");
  assert.equal(t3.category, "groc");
  assert.match(t3.description, /groceries/i);
  assert.equal(t3.occurred, "2026-10-16");

  // 4. "Paid 120 rupees for petrol."
  const t4 = parseVoiceTranscript("Paid 120 rupees for petrol.", { now: fixedDate });
  assert.equal(t4.amount, "120");
  assert.equal(t4.category, "trans");
  assert.match(t4.description, /petrol/i);

  // 5. "Bought rice for 800 rupees from the supermarket."
  const t5 = parseVoiceTranscript("Bought rice for 800 rupees from the supermarket.", { now: fixedDate });
  assert.equal(t5.amount, "800");
  assert.equal(t5.category, "groc");
  assert.match(t5.description, /rice/i);

  // 6. "Vegetables 150, fruits 100." (multi-item total and breakdown)
  const t6 = parseVoiceTranscript("Vegetables 150, fruits 100.", { now: fixedDate });
  assert.equal(t6.amount, "250");
  assert.equal(t6.category, "veg");
  assert.match(t6.description, /vegetables.*fruits/i);
  assert.match(t6.notes, /150.*100/);
});

test("handles natural bare item-amount patterns without explicit currency", () => {
  const veg = parseVoiceTranscript("Vegetables 150", { now: fixedDate });
  assert.equal(veg.amount, "150");
  assert.equal(veg.category, "veg");

  const milk = parseVoiceTranscript("Milk 60", { now: fixedDate });
  assert.equal(milk.amount, "60");
  assert.equal(milk.category, "milk");

  const petrol = parseVoiceTranscript("Petrol 120", { now: fixedDate });
  assert.equal(petrol.amount, "120");
  assert.equal(petrol.category, "trans");
});

test("handles voice input with only an amount or without an amount", () => {
  const onlyAmount = parseVoiceTranscript("500 rupees", { now: fixedDate });
  assert.equal(onlyAmount.amount, "500");

  const noAmount = parseVoiceTranscript("Bought groceries from the supermarket today.", { now: fixedDate });
  assert.equal(noAmount.amount, "");
  assert.equal(noAmount.category, "groc");
  assert.equal(noAmount.occurred, "2026-10-17");
});

test("handles mixed Tamil-English voice expressions", () => {
  const mixed = parseVoiceTranscript("Petrol 120 ரூபாய்", { now: fixedDate });
  assert.equal(mixed.amount, "120");
  assert.equal(mixed.category, "trans");

  const mixedVeg = parseVoiceTranscript("காய்கறி 150", { now: fixedDate });
  assert.equal(mixedVeg.amount, "150");
  assert.equal(mixedVeg.category, "veg");
});

test("parses English payer and payment source dictation examples", () => {
  const members = [
    { user_id: "me", name: "Yadav" },
    { user_id: "dad-id", name: "Dad" },
    { user_id: "mom-id", name: "Mom" }
  ];

  // 1. "I bought milk for 60 rupees using my personal money."
  const e1 = parseVoiceTranscript("I bought milk for 60 rupees using my personal money.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(e1.amount, "60");
  assert.equal(e1.category, "milk");
  assert.equal(e1.paid_by, "me");
  assert.equal(e1.payment_source, "PERSONAL");
  assert.equal(e1.funding, "personal");
  assert.match(e1.description, /milk/i);

  // 2. "Dad paid 500 rupees for groceries from household money."
  const e2 = parseVoiceTranscript("Dad paid 500 rupees for groceries from household money.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(e2.amount, "500");
  assert.equal(e2.category, "groc");
  assert.equal(e2.paid_by, "dad-id");
  assert.equal(e2.payment_source, "SHARED_HOUSEHOLD");
  assert.equal(e2.funding, "shared");
  assert.match(e2.description, /groceries/i);

  // 3. "Mom bought vegetables for 150 rupees."
  const e3 = parseVoiceTranscript("Mom bought vegetables for 150 rupees.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(e3.amount, "150");
  assert.equal(e3.category, "veg");
  assert.equal(e3.paid_by, "mom-id");
  assert.equal(e3.payment_source, "");
  assert.match(e3.description, /vegetables/i);

  // 4. "I paid 200 rupees for electricity from shared funds."
  const e4 = parseVoiceTranscript("I paid 200 rupees for electricity from shared funds.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(e4.amount, "200");
  assert.equal(e4.category, "bill");
  assert.equal(e4.paid_by, "me");
  assert.equal(e4.payment_source, "SHARED_HOUSEHOLD");
  assert.equal(e4.funding, "shared");
  assert.match(e4.description, /electricity/i);
});

test("parses Tamil payer and payment source dictation examples", () => {
  const members = [
    { user_id: "me", name: "யாதவ்" },
    { user_id: "dad-id", name: "அப்பா" },
    { user_id: "mom-id", name: "அம்மா" }
  ];

  // 1. "நான் என்னுடைய சொந்த பணத்தில் 60 ரூபாய்க்கு பால் வாங்கினேன்."
  const t1 = parseVoiceTranscript("நான் என்னுடைய சொந்த பணத்தில் 60 ரூபாய்க்கு பால் வாங்கினேன்.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(t1.amount, "60");
  assert.equal(t1.category, "milk");
  assert.equal(t1.paid_by, "me");
  assert.equal(t1.payment_source, "PERSONAL");
  assert.equal(t1.funding, "personal");
  assert.match(t1.description, /பால்/);

  // 2. "அப்பா வீட்டுப் பணத்திலிருந்து 500 ரூபாய்க்கு மளிகை பொருட்கள் வாங்கினார்."
  const t2 = parseVoiceTranscript("அப்பா வீட்டுப் பணத்திலிருந்து 500 ரூபாய்க்கு மளிகை பொருட்கள் வாங்கினார்.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(t2.amount, "500");
  assert.equal(t2.category, "groc");
  assert.equal(t2.paid_by, "dad-id");
  assert.equal(t2.payment_source, "SHARED_HOUSEHOLD");
  assert.equal(t2.funding, "shared");
  assert.match(t2.description, /மளிகை/);

  // 3. "அம்மா 150 ரூபாய்க்கு காய்கறி வாங்கினாங்க."
  const t3 = parseVoiceTranscript("அம்மா 150 ரூபாய்க்கு காய்கறி வாங்கினாங்க.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(t3.amount, "150");
  assert.equal(t3.category, "veg");
  assert.equal(t3.paid_by, "mom-id");
  assert.equal(t3.payment_source, "");
  assert.match(t3.description, /காய்கறி/);

  // 4. "நான் பொதுவான வீட்டுப் பணத்திலிருந்து 200 ரூபாய் மின்சார கட்டணம் செலுத்தினேன்."
  const t4 = parseVoiceTranscript("நான் பொதுவான வீட்டுப் பணத்திலிருந்து 200 ரூபாய் மின்சார கட்டணம் செலுத்தினேன்.", {
    members, currentUserId: "me", now: fixedDate
  });
  assert.equal(t4.amount, "200");
  assert.equal(t4.category, "bill");
  assert.equal(t4.paid_by, "me");
  assert.equal(t4.payment_source, "SHARED_HOUSEHOLD");
  assert.equal(t4.funding, "shared");
  assert.match(t4.description, /மின்சார/);
});

test("matches registered member names and tokens without alias guessing", () => {
  const members = [
    { user_id: "me", name: "Yadav" },
    { user_id: "dad-id", name: "Dad Kumar" },
    { user_id: "mom-id", name: "அம்மா" }
  ];

  const tDad = parseVoiceTranscript("Dad paid 500 rupees for groceries", { members, currentUserId: "me", now: fixedDate });
  assert.equal(tDad.paid_by, "dad-id");
  assert.equal(tDad.needsPayer, false);

  const tMom = parseVoiceTranscript("அம்மா 300 ரூபாய் பால்", { members, currentUserId: "me", now: fixedDate });
  assert.equal(tMom.paid_by, "mom-id");
  assert.equal(tMom.needsPayer, false);
});

test("handles ambiguous family member references without guessing", () => {
  const members = [
    { user_id: "u1", name: "Yadav" },
    { user_id: "u2", name: "Karthik" },
    { user_id: "u3", name: "Priya" }
  ];

  const d1 = parseVoiceTranscript("Dad paid 500 for milk", { members, currentUserId: "u1", now: fixedDate });
  assert.equal(d1.paid_by, "");
  assert.equal(d1.needsPayer, true);

  const d2 = parseVoiceTranscript("Appa bought groceries for 400", { members, currentUserId: "u1", now: fixedDate });
  assert.equal(d2.paid_by, "");
  assert.equal(d2.needsPayer, true);

  const d3 = parseVoiceTranscript("அம்மா 300 ரூபாய் காய்கறி வாங்கினார்", { members, currentUserId: "u1", now: fixedDate });
  assert.equal(d3.paid_by, "");
  assert.equal(d3.needsPayer, true);
});

test("strips payment source phrases from description while preserving genuine phrases", () => {
  // 1. "Milk personal 100 rupees" -> "Milk"
  const d1 = parseVoiceTranscript("Milk personal 100 rupees", { now: fixedDate });
  assert.equal(d1.amount, "100");
  assert.equal(d1.description, "Milk");
  assert.equal(d1.payment_source, "PERSONAL");

  // 2. "Personal care products 200 rupees" -> preserves "Personal care products"
  const d2 = parseVoiceTranscript("Personal care products 200 rupees", { now: fixedDate });
  assert.equal(d2.amount, "200");
  assert.match(d2.description, /Personal care products/i);

  // 3. "Groceries shared household 500 rupees" -> "Groceries"
  const d3 = parseVoiceTranscript("Groceries shared household 500 rupees", { now: fixedDate });
  assert.equal(d3.amount, "500");
  assert.equal(d3.description, "Groceries");
  assert.equal(d3.payment_source, "SHARED_HOUSEHOLD");

  // 4. "Personal money la 100 ku milk vanginen" -> "Milk"
  const d4 = parseVoiceTranscript("Personal money la 100 ku milk vanginen", { now: fixedDate });
  assert.equal(d4.amount, "100");
  assert.equal(d4.description, "Milk");
  assert.equal(d4.payment_source, "PERSONAL");
});

test("accurately parses relative dates in English, Tanglish, and Tamil", () => {
  // Reference fixedDate is 2026-10-17
  // 1. Yesterday -> 2026-10-16
  const y1 = parseVoiceTranscript("Yesterday milk 60 rupees", { now: fixedDate });
  assert.equal(y1.occurred, "2026-10-16");

  // 2. Tamil நேற்று -> 2026-10-16
  const y2 = parseVoiceTranscript("நேற்று காய்கறி 150 ரூபாய்", { now: fixedDate });
  assert.equal(y2.occurred, "2026-10-16");

  // 3. Tanglish nethu -> 2026-10-16
  const y3 = parseVoiceTranscript("nethu petrol 200", { now: fixedDate });
  assert.equal(y3.occurred, "2026-10-16");

  // 4. Day before yesterday -> 2026-10-15
  const dby = parseVoiceTranscript("day before yesterday groceries 500", { now: fixedDate });
  assert.equal(dby.occurred, "2026-10-15");

  // 5. Tanglish inniku -> 2026-10-17
  const td = parseVoiceTranscript("inniku dinner 300", { now: fixedDate });
  assert.equal(td.occurred, "2026-10-17");

  // 6. Tomorrow -> 2026-10-18
  const tm = parseVoiceTranscript("tomorrow movie tickets 250", { now: fixedDate });
  assert.equal(tm.occurred, "2026-10-18");
});
