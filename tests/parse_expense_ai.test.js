import test from "node:test";
import assert from "node:assert/strict";
import { createExpenseAiHandler } from "../supabase/functions/parse-expense-ai/handler.mjs";
import {
  validateTranscript,
  validateAndSanitizeExpenses,
  BUILTIN_CATEGORIES
} from "../supabase/functions/parse-expense-ai/validation.mjs";

const defaultEnv = {
  SUPABASE_URL: "https://project.example",
  SUPABASE_ANON_KEY: "public-anon-key",
  GROQ_API_KEY: "server-only-test-key",
  GROQ_CHAT_MODEL: "llama-3.3-70b-versatile"
};

function harness({ env = {}, user = { id: "user-1" }, authError = null, membership = { role: "member" }, fetchImpl } = {}) {
  const calls = { token: "", provider: 0, providerRequest: null };
  const values = { ...defaultEnv, ...env };

  const handler = createExpenseAiHandler({
    env: name => values[name],
    createClient: () => ({
      auth: {
        getUser: async token => {
          calls.token = token;
          return { data: { user }, error: authError };
        }
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: membership, error: null })
            })
          })
        })
      })
    }),
    fetchImpl: fetchImpl || (async (url, options) => {
      calls.provider += 1;
      calls.providerRequest = { url, options };
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                expenses: [
                  {
                    description: "Milk",
                    amount: 60,
                    currency: "INR",
                    category: "milk",
                    date: "2026-11-20",
                    notes: "",
                    paid_by: "user-1",
                    payment_source: "PERSONAL",
                    confidence: { amount: 0.95, description: 0.9, category: 0.85, date: 0.95, paid_by: 0.9, payment_source: 0.9 },
                    needs_clarification: []
                  }
                ]
              })
            }
          }
        ]
      });
    })
  });

  return { handler, calls };
}

function aiRequest({ token = "signed-in-user-token", body = { transcript: "Milk 60 rupees" } } = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  return new Request("https://edge.example/parse-expense-ai", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

async function responseJson(res) {
  return { status: res.status, body: await res.json() };
}

test("parse-expense-ai: rejects unauthorized requests and handles OPTIONS preflight", async () => {
  const unauthorized = harness({ authError: new Error("invalid token"), user: null });
  const noTokenRes = await responseJson(await unauthorized.handler(aiRequest({ token: "" })));
  assert.equal(noTokenRes.status, 401);

  const invalidTokenRes = await responseJson(await unauthorized.handler(aiRequest()));
  assert.equal(invalidTokenRes.status, 401);
  assert.equal(unauthorized.calls.provider, 0);

  const preflight = await harness().handler(new Request("https://edge.example/parse-expense-ai", { method: "OPTIONS" }));
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
});

test("parse-expense-ai: fails safely when GROQ_API_KEY is missing", async () => {
  const missingKey = harness({ env: { GROQ_API_KEY: undefined } });
  const res = await responseJson(await missingKey.handler(aiRequest()));
  assert.equal(res.status, 503);
  assert.equal(res.body.code, "provider_not_configured");
  assert.equal(missingKey.calls.provider, 0);
});

test("parse-expense-ai: handles empty and overlong transcripts without calling provider", async () => {
  const instance = harness();
  const emptyRes = await responseJson(await instance.handler(aiRequest({ body: { transcript: "   " } })));
  assert.equal(emptyRes.status, 200);
  assert.deepEqual(emptyRes.body.expenses, []);
  assert.equal(instance.calls.provider, 0);

  const overlongRes = await responseJson(await instance.handler(aiRequest({ body: { transcript: "a".repeat(1001) } })));
  assert.equal(overlongRes.status, 400);
  assert.equal(overlongRes.body.code, "transcript_too_long");
  assert.equal(instance.calls.provider, 0);
});

test("parse-expense-ai: sends request to Groq and sanitizes extracted expenses", async () => {
  const instance = harness();
  const res = await responseJson(await instance.handler(aiRequest({
    body: {
      transcript: "Milk 60 rupees",
      household_id: "hh-1",
      members: [{ user_id: "user-1", name: "Me" }]
    }
  })));

  assert.equal(res.status, 200);
  assert.equal(instance.calls.provider, 1);
  assert.equal(res.body.expenses.length, 1);
  const exp = res.body.expenses[0];
  assert.equal(exp.description, "Milk");
  assert.equal(exp.amount, 60);
  assert.equal(exp.category, "milk");
  assert.equal(exp.paid_by, "user-1");
  assert.equal(exp.payment_source, "PERSONAL");
  assert.equal(exp.confidence.amount, 0.95);
});

test("parse-expense-ai: handles multi-expense splitting correctly", () => {
  const multiRaw = [
    { description: "Milk", amount: 60, category: "milk" },
    { description: "Vegetables", amount: 150, category: "veg" },
    { description: "Fruits", amount: 100, category: "veg" }
  ];
  const sanitized = validateAndSanitizeExpenses(multiRaw, { members: [{ user_id: "u1" }] });
  assert.equal(sanitized.length, 3);
  assert.equal(sanitized[0].amount, 60);
  assert.equal(sanitized[1].amount, 150);
  assert.equal(sanitized[2].amount, 100);
  const total = sanitized.reduce((sum, e) => sum + e.amount, 0);
  assert.equal(total, 310);
});

test("parse-expense-ai: flags ambiguous input in needs_clarification and rejects invalid amounts", () => {
  const raw = [
    { description: "", amount: 200, category: "" },
    { description: "Invalid amount item", amount: -50 }
  ];
  const sanitized = validateAndSanitizeExpenses(raw, { members: [] });
  assert.equal(sanitized[0].needs_clarification.includes("description"), true);
  assert.equal(sanitized[0].needs_clarification.includes("category"), true);
  assert.equal(sanitized[1].needs_clarification.includes("amount"), true);
  assert.equal(sanitized[1].amount, 0);
});
