import {
  BUILTIN_CATEGORIES,
  validateAndSanitizeExpenses,
  validateTranscript
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

export function buildSystemPrompt({ members = [], currentUserId = "", today = new Date().toISOString().slice(0, 10), customCategories = [], language = "en" }) {
  const categoriesList = [
    ...BUILTIN_CATEGORIES,
    ...customCategories.map(c => typeof c === "string" ? c : c.key)
  ];

  const membersDesc = members.map(m => `- Name: "${m.name || "Unknown"}", user_id: "${m.user_id || m.id}"`).join("\n") || "None";

  return `You are Hearth AI, an expert financial parsing engine for Indian household expense tracking.
Your task is to analyze user speech transcripts and convert them into structured expense records in valid JSON.
Today's local date is ${today}.
Primary Dictation Language: ${language === 'ta' ? 'Tamil (தமிழ்)' : 'English (India) with Tanglish / Tamil code-switching'}.

Supported Categories:
${categoriesList.join(", ")}
(veg: Vegetables/Fruits, groc: Groceries/Provisions/Supermarket, milk: Dairy/Milk/Curd, snk: Snacks/Tea/Coffee, bill: Electricity/Water/Wifi/Phone bills, gas: Cooking LPG/Cylinder, rent: Rent/Housing maintenance, trans: Petrol/Diesel/Auto/Cab/Bus/Travel, shop: Clothing/Amazon/Flipkart, fun: Movies/Entertainment, hlth: Medicine/Doctor/Pharmacy, home: Cleaning/Detergent/Repairs, oth: Other)

Household Members:
${membersDesc}

Current User ID: "${currentUserId}"

Extraction Rules:
1. LANGUAGE: Understand English, Tamil (தமிழ்), Indian English, and Tamil-English code-switching (Tanglish, e.g. "Naan milk 60 rupees ku vanginen", "Appa veetu panathula 500 groceries vanginar").
2. NUMBERS: Support digits (50, 60), currency words (rupees, rs, inr, ரூபாய், ரூபாய்க்கு, ruba, roobai), Tamil words (ஐம்பது, அறுபது, நூறு, ஆயிரம்), and Tanglish numbers (ambadhu=50, aruvadhu=60, nooru=100, ayiram=1000, rendu=2, moonu=3, etc.).
3. MULTIPLE EXPENSES: If the sentence lists multiple purchases (e.g. "Today I bought milk for 60, vegetables for 150 and fruits for 100"), output each as a SEPARATE object in the "expenses" array! Do not combine them!
4. DESCRIPTION CLEANING: The description MUST contain ONLY the item or service purchased (e.g., "Milk", "Vegetables", "Groceries", "Bus expenses"). Do NOT include payment source words ("personal", "shared household", "from personal money", "sontha panam", "veetu panam") OR payer phrases ("paid by <name>", "by <name>", "<name> paid", "bought by <name>", "<name> vanginaar") in the description!
   - Example 1: "100 for bus expenses paid by Nagarajan" -> description: "Bus expenses", amount: 100, paid_by: "<user_id of nagarajan>".
   - Example 2: "rs.100 for bus expences paid by nagarajan" -> description: "Bus expences", amount: 100, paid_by: "<user_id of nagarajan>".
   - Example 3: "Milk personal 100 rupees" -> description: "Milk", payment_source: "PERSONAL".
   - (Exception: "personal care" is a legitimate item name, do not alter "Personal care products").
5. SPOKEN CORRECTIONS: If the speaker corrects themselves (e.g. "Vegetables 150 wait no 180"), extract the corrected final value (180).
6. AMBIGUOUS / INCOMPLETE: If an expense lacks amount or description (e.g. "I spent 200"), do NOT invent details or categories. Return empty description or null, and list the missing field in "needs_clarification".
7. UNRELATED CONVERSATION: If the speech is greeting, casual talk, or not an expense ("Hello good morning"), return {"expenses": []}.
8. PAYER (paid_by):
   - "I / my / naan / en / enakku / mine" -> map to Current User ID "${currentUserId}".
   - If an actual registered household member's name is mentioned, map to their user_id.
   - Do NOT guess a household member based on an ambiguous role (Dad, Mom, Appa, Amma, etc.). If a role is mentioned without an exact registered member name match, leave paid_by: null and add "paid_by" to "needs_clarification".
9. PAYMENT SOURCE (payment_source):
   - "PERSONAL": personal pocket money, sontha panam, sontha kaasu, my own money.
   - "SHARED_HOUSEHOLD": household money, common fund, veetu panam, veetu kaasu, shared funds.
   - If not mentioned or ambiguous, default to null or "PERSONAL".
10. DATES: Calculate relative dates from today's local date (${today}):
   - "today" / "இன்று" / "inniku" -> "${today}"
   - "yesterday" / "நேற்று" / "nethu" -> 1 day before ${today}
   - "day before yesterday" / "முந்தாநேற்று" / "munthanethu" -> 2 days before ${today}
   - "tomorrow" / "நாளை" / "naalaiku" -> 1 day after ${today}

Output MUST be a JSON object with this exact schema:
{
  "expenses": [
    {
      "description": "Clean concise item title (e.g. Milk)",
      "amount": 150.00,
      "currency": "INR",
      "category": "veg",
      "date": "YYYY-MM-DD" or null,
      "notes": "Optional extra details",
      "paid_by": "valid user_id" or null,
      "payment_source": "PERSONAL" or "SHARED_HOUSEHOLD" or null,
      "confidence": {
        "amount": 0.95,
        "description": 0.9,
        "category": 0.85,
        "date": 0.95,
        "paid_by": 0.9,
        "payment_source": 0.9
      },
      "needs_clarification": []
    }
  ]
}`;
}

export function createExpenseAiHandler({ env, createClient, fetchImpl = fetch }) {
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

    let body;
    try {
      body = await request.json();
    } catch {
      return respond(400, { code: "invalid_payload" });
    }

    const transcript = body.transcript;
    const invalid = validateTranscript(transcript);
    if (invalid) {
      if (invalid === "empty_transcript") return respond(200, { expenses: [] });
      return respond(400, { code: invalid });
    }

    const householdId = body.household_id;
    if (householdId) {
      const { data: membership, error } = await supabase
        .from("household_members")
        .select("role")
        .eq("household_id", householdId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !membership) {
        return respond(403, { code: "forbidden_household" });
      }
    }

    const members = Array.isArray(body.members) ? body.members : [];
    const customCategories = Array.isArray(body.customCategories) ? body.customCategories : [];
    const currentUserId = user.id;

    const chatModel = env("GROQ_CHAT_MODEL") || "llama-3.3-70b-versatile";
    const language = body.language || "en";
    const clientToday = (typeof body.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today))
      ? body.today
      : new Date().toISOString().slice(0, 10);

    const systemPrompt = buildSystemPrompt({
      members,
      currentUserId,
      customCategories,
      language,
      today: clientToday
    });

    let providerResponse;
    try {
      providerResponse = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: chatModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: transcript.trim() }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout(30_000)
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return respond(504, { code: "provider_timeout" });
      }
      return respond(502, { code: "provider_network_error" });
    }

    if (!providerResponse.ok) {
      const status = providerResponse.status;
      if (status === 429) return respond(429, { code: "provider_rate_limited" });
      return respond(status === 401 || status === 403 ? 503 : 502, {
        code: status === 401 || status === 403 ? "provider_unavailable" : "provider_error"
      });
    }

    let parsedResult = {};
    try {
      const resultJson = await providerResponse.json();
      const content = resultJson.choices?.[0]?.message?.content || "{}";
      parsedResult = JSON.parse(content);
    } catch {
      return respond(502, { code: "invalid_model_response" });
    }

    const rawExpenses = parsedResult.expenses || (parsedResult.description ? [parsedResult] : []);
    const sanitizedExpenses = validateAndSanitizeExpenses(rawExpenses, {
      members,
      allowedCategories: [...BUILTIN_CATEGORIES, ...customCategories.map(c => typeof c === "string" ? c : c.key)]
    });

    return respond(200, { expenses: sanitizedExpenses });
  };
}
