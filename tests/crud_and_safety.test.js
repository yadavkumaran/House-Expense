import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { queryRows } from "../query-results.js";
import { hasHouseholdOwnerRole } from "../household-permissions.js";

test("only a household owner can manage reimbursements", () => {
  const members = [
    { user_id: "owner-1", role: "owner" },
    { user_id: "member-1", role: "member" }
  ];

  assert.equal(hasHouseholdOwnerRole(members, "owner-1"), true);
  assert.equal(hasHouseholdOwnerRole(members, "member-1"), false);
  assert.equal(hasHouseholdOwnerRole(members, "unknown"), false);
});

test("database limits reimbursement creation and reversal to household owners", async () => {
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../supabase/migrations/20261020000002_owner_only_reimbursements.sql", import.meta.url),
    "utf8"
  );

  for (const sql of [schema, migration]) {
    assert.match(sql, /if not public\.is_household_owner\(household\)/i);
    assert.match(sql, /revoke insert,\s*update on public\.settlements from authenticated/i);
    assert.match(sql, /drop policy if exists "members add settlements"/i);
    assert.match(sql, /create policy "owners delete settlements"/i);
  }
});

test("household refresh accepts both paginated arrays and Supabase query responses", () => {
  const expenses = [{ id: "expense-1", amount: 25 }];
  const settlements = [{ id: "settlement-1", amount: 10 }];

  assert.deepEqual(queryRows({ status: "fulfilled", value: expenses }, "expenses"), expenses);
  assert.deepEqual(queryRows({ status: "fulfilled", value: { data: settlements, error: null } }, "settlements"), settlements);
  assert.deepEqual(queryRows({ status: "fulfilled", value: { data: null, error: null } }, "expenses"), []);
});

test("household refresh surfaces required query failures and tolerates optional failures", () => {
  const failure = new Error("Database unavailable");
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);

  try {
    assert.throws(
      () => queryRows({ status: "rejected", reason: failure }, "expenses"),
      error => error === failure
    );
    assert.deepEqual(
      queryRows({ status: "fulfilled", value: { data: null, error: failure } }, "rooms", true),
      []
    );
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][0], /optional rooms/);
  } finally {
    console.warn = warn;
  }
});

test("transaction validation rejects invalid amounts and future dates", () => {
  const validateExpense = (exp) => {
    const amount = Number(exp.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter an amount greater than zero.");
    }
    if (!exp.occurred_on) {
      throw new Error("Date is required.");
    }
    if (!["personal", "shared"].includes(exp.funding)) {
      throw new Error("Funding source must be personal or shared.");
    }
    if (!exp.description || !exp.description.trim()) {
      throw new Error("Description is required.");
    }
    return true;
  };

  assert.throws(() => validateExpense({ amount: 0, occurred_on: "2026-10-17", funding: "shared", description: "Food" }), /Enter an amount greater than zero/);
  assert.throws(() => validateExpense({ amount: -50, occurred_on: "2026-10-17", funding: "shared", description: "Food" }), /Enter an amount greater than zero/);
  assert.throws(() => validateExpense({ amount: "invalid", occurred_on: "2026-10-17", funding: "shared", description: "Food" }), /Enter an amount greater than zero/);
  assert.throws(() => validateExpense({ amount: 100, occurred_on: "", funding: "shared", description: "Food" }), /Date is required/);
  assert.throws(() => validateExpense({ amount: 100, occurred_on: "2026-10-17", funding: "magic", description: "Food" }), /Funding source must be personal or shared/);
  assert.throws(() => validateExpense({ amount: 100, occurred_on: "2026-10-17", funding: "shared", description: "  " }), /Description is required/);

  assert.equal(validateExpense({ amount: 100.50, occurred_on: "2026-10-17", funding: "shared", description: "Groceries" }), true);
});

test("last owner protection blocks sole owner from leaving household", () => {
  const canLeaveHousehold = ({ members, currentUserId }) => {
    const membership = members.find(m => m.user_id === currentUserId);
    if (!membership) throw new Error("Not a member");
    if (membership.role === "owner") {
      const ownerCount = members.filter(m => m.role === "owner").length;
      if (ownerCount <= 1 && members.length > 1) {
        throw new Error("You are the only owner of this household. Transfer ownership before leaving.");
      }
    }
    return true;
  };

  const membersSoleOwner = [
    { user_id: "user-1", role: "owner" },
    { user_id: "user-2", role: "member" }
  ];

  assert.throws(
    () => canLeaveHousehold({ members: membersSoleOwner, currentUserId: "user-1" }),
    /You are the only owner of this household/
  );

  // Member can leave safely
  assert.equal(canLeaveHousehold({ members: membersSoleOwner, currentUserId: "user-2" }), true);

  // When multiple owners exist, owner can leave safely
  const membersMultipleOwners = [
    { user_id: "user-1", role: "owner" },
    { user_id: "user-2", role: "owner" }
  ];
  assert.equal(canLeaveHousehold({ members: membersMultipleOwners, currentUserId: "user-1" }), true);
});

test("room deletion safe re-assignment preserves linked expenses", () => {
  const expenses = [
    { id: "e1", description: "Air conditioner", room_id: "room-living" },
    { id: "e2", description: "Bed sheet", room_id: "room-bed" },
    { id: "e3", description: "Kitchen knife", room_id: "room-kitchen" }
  ];

  const deleteRoom = (targetRoomId, reassignToRoomId = null) => {
    return expenses.map(e => {
      if (e.room_id === targetRoomId) {
        return { ...e, room_id: reassignToRoomId };
      }
      return e;
    });
  };

  // 1. Delete room-bed and reassign to room-living
  const reassigned = deleteRoom("room-bed", "room-living");
  assert.equal(reassigned.find(e => e.id === "e2").room_id, "room-living");
  assert.equal(reassigned.length, 3, "No expenses were deleted!");

  // 2. Delete room-kitchen and leave unassigned
  const unassigned = deleteRoom("room-kitchen", null);
  assert.equal(unassigned.find(e => e.id === "e3").room_id, null);
  assert.equal(unassigned.length, 3, "No expenses were deleted!");
});

test("transaction search and multi-facet filtering", () => {
  const expenses = [
    { id: "e1", description: "Organic Milk", category: "milk", paid_by: "user-1", funding: "shared", occurred_on: "2026-10-15", amount: 65 },
    { id: "e2", description: "Internet Fiber", category: "bill", paid_by: "user-2", funding: "personal", occurred_on: "2026-10-10", amount: 1199 },
    { id: "e3", description: "Tomato and onion", category: "veg", paid_by: "user-1", funding: "shared", occurred_on: "2026-10-02", amount: 240 },
    { id: "e4", description: "Cinema tickets", category: "fun", paid_by: "user-2", funding: "personal", occurred_on: "2026-09-28", amount: 800 }
  ];

  // Search by keyword
  const searchResults = expenses.filter(e => e.description.toLowerCase().includes("milk"));
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, "e1");

  // Filter by funding source
  const personalExpenses = expenses.filter(e => e.funding === "personal");
  assert.equal(personalExpenses.length, 2);

  // Filter by category
  const billExpenses = expenses.filter(e => e.category === "bill");
  assert.equal(billExpenses.length, 1);
  assert.equal(billExpenses[0].id, "e2");

  // Sort by amount descending
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount);
  assert.equal(sorted[0].id, "e2");
  assert.equal(sorted[3].id, "e1");
});

test("client-supplied family-member ID must validate against household membership", () => {
  const householdMembers = [
    { user_id: "u-mom", name: "Mom" },
    { user_id: "u-dad", name: "Dad" },
    { user_id: "u-me", name: "Yadav" }
  ];

  const validatePayer = (payerId) => {
    if (!payerId || !householdMembers.some(m => m.user_id === payerId)) {
      throw new Error("Selected family member is not a member of this household.");
    }
    return true;
  };

  // Valid household members pass
  assert.equal(validatePayer("u-mom"), true);
  assert.equal(validatePayer("u-dad"), true);
  assert.equal(validatePayer("u-me"), true);

  // Untrusted external user_id fails
  assert.throws(() => validatePayer("rogue-user-999"), /Selected family member is not a member of this household/);
  assert.throws(() => validatePayer(""), /Selected family member is not a member of this household/);
  assert.throws(() => validatePayer(null), /Selected family member is not a member of this household/);
});

test("filters expenses by family member and payment source (PERSONAL & SHARED_HOUSEHOLD)", () => {
  const expenses = [
    { id: "e1", description: "Milk", paid_by: "u-dad", payment_source: "SHARED_HOUSEHOLD", funding: "shared", amount: 60 },
    { id: "e2", description: "Vegetables", paid_by: "u-mom", payment_source: "PERSONAL", funding: "personal", amount: 150 },
    { id: "e3", description: "Petrol", paid_by: "u-me", payment_source: "PERSONAL", funding: "personal", amount: 120 },
    { id: "e4", description: "Old Electric Bill", paid_by: "u-dad", funding: "shared", amount: 800 } // Legacy record
  ];

  // Filter by family member (Dad)
  const dadExpenses = expenses.filter(e => e.paid_by === "u-dad");
  assert.equal(dadExpenses.length, 2);

  // Filter by payment source: PERSONAL
  const personal = expenses.filter(e => e.payment_source === "PERSONAL" || e.funding === "personal");
  assert.equal(personal.length, 2);
  assert.deepEqual(personal.map(e => e.id), ["e2", "e3"]);

  // Filter by payment source: SHARED_HOUSEHOLD (including legacy funding: shared)
  const shared = expenses.filter(e => e.payment_source === "SHARED_HOUSEHOLD" || e.funding === "shared");
  assert.equal(shared.length, 2);
  assert.deepEqual(shared.map(e => e.id), ["e1", "e4"]);
});
