import test from "node:test";
import assert from "node:assert/strict";
import {
  toMinorUnits,
  fromMinorUnits,
  addCurrency,
  subtractCurrency,
  calculateExpenseTotal,
  calculatePersonalReimbursements,
  calculateCategoryBreakdown,
  calculateRoomBreakdown,
  calculateBudgetStatus
} from "../accounting.js";

test("precision minor-unit arithmetic prevents IEEE 754 floating-point inaccuracies", () => {
  // Typical IEEE 754 bug: 0.1 + 0.2 = 0.30000000000000004
  const sum = addCurrency(0.1, 0.2);
  assert.equal(sum, 0.3);

  // 19.99 + 49.99 = 69.98
  assert.equal(addCurrency(19.99, 49.99), 69.98);
  assert.equal(subtractCurrency(100.00, 33.33), 66.67);

  assert.equal(toMinorUnits(1234.56), 123456);
  assert.equal(fromMinorUnits(123456), 1234.56);
  assert.equal(toMinorUnits("₹1,250.75"), 125075);
});

test("filtered transaction totals use paise precision and exclude deleted entries", () => {
  assert.equal(calculateExpenseTotal([
    { amount: 0.1 },
    { amount: 0.2 },
    { amount: 10.25 },
    { amount: 100, deleted_at: "2026-10-01T00:00:00Z" }
  ]), 10.55);
  assert.equal(calculateExpenseTotal([]), 0);
});

test("spending from personal pocket creates a reimbursement liability", () => {
  const members = [
    { user_id: "user-me", name: "Me" },
    { user_id: "user-alice", name: "Alice" }
  ];

  const expenses = [
    {
      id: "e1",
      amount: 1500.50,
      paid_by: "user-alice",
      funding: "personal",
      category: "groc"
    }
  ];

  const reimbursements = calculatePersonalReimbursements({
    members,
    expenses,
    settlements: [],
    currentUserId: "user-me"
  });

  assert.equal(reimbursements.length, 1);
  assert.equal(reimbursements[0].member.user_id, "user-alice");
  assert.equal(reimbursements[0].paid, 1500.50);
  assert.equal(reimbursements[0].repaid, 0);
  assert.equal(reimbursements[0].outstanding, 1500.50);
});

test("spending from shared household funds does NOT create personal reimbursement liability", () => {
  const members = [
    { user_id: "user-me", name: "Me" },
    { user_id: "user-alice", name: "Alice" }
  ];

  const expenses = [
    {
      id: "e1",
      amount: 2500,
      paid_by: "user-alice",
      funding: "shared", // Shared household funds!
      category: "rent"
    }
  ];

  const reimbursements = calculatePersonalReimbursements({
    members,
    expenses,
    settlements: [],
    currentUserId: "user-me"
  });

  // Zero liability created because funding was shared!
  assert.equal(reimbursements.length, 0);
});

test("partial and full settlements reduce outstanding liability correctly", () => {
  const members = [
    { user_id: "user-me", name: "Me" },
    { user_id: "user-bob", name: "Bob" }
  ];

  const expenses = [
    {
      id: "e1",
      amount: 3000,
      paid_by: "user-bob",
      funding: "personal",
      category: "elec"
    }
  ];

  // Bob paid 3000 personal.
  // First partial settlement: 1000
  const settlements = [
    {
      id: "s1",
      from_user: "user-me",
      to_user: "user-bob",
      amount: 1000,
      settled_on: "2026-10-01"
    }
  ];

  let res = calculatePersonalReimbursements({
    members,
    expenses,
    settlements,
    currentUserId: "user-me"
  });

  assert.equal(res[0].paid, 3000);
  assert.equal(res[0].repaid, 1000);
  assert.equal(res[0].outstanding, 2000);

  // Second partial settlement: 2000 (now fully settled)
  settlements.push({
    id: "s2",
    from_user: "user-me",
    to_user: "user-bob",
    amount: 2000,
    settled_on: "2026-10-05"
  });

  res = calculatePersonalReimbursements({
    members,
    expenses,
    settlements,
    currentUserId: "user-me"
  });

  assert.equal(res[0].paid, 3000);
  assert.equal(res[0].repaid, 3000);
  assert.equal(res[0].outstanding, 0);
});

test("reversing or soft-deleting a settlement restores the outstanding balance", () => {
  const members = [
    { user_id: "user-me", name: "Me" },
    { user_id: "user-bob", name: "Bob" }
  ];

  const expenses = [
    {
      id: "e1",
      amount: 1200,
      paid_by: "user-bob",
      funding: "personal"
    }
  ];

  const settlements = [
    {
      id: "s1",
      from_user: "user-me",
      to_user: "user-bob",
      amount: 1200,
      deleted_at: "2026-10-10T12:00:00Z" // Deleted / reversed!
    }
  ];

  const res = calculatePersonalReimbursements({
    members,
    expenses,
    settlements,
    currentUserId: "user-me"
  });

  // Since settlement was reversed/deleted, Bob is owed 1200 again!
  assert.equal(res[0].outstanding, 1200);
  assert.equal(res[0].repaid, 0);
});

test("soft-deleting an expense removes it from reimbursements and budget calculations", () => {
  const members = [
    { user_id: "user-me", name: "Me" },
    { user_id: "user-bob", name: "Bob" }
  ];

  const expenses = [
    {
      id: "e1",
      amount: 800,
      paid_by: "user-bob",
      funding: "personal",
      category: "veg",
      deleted_at: "2026-10-15T00:00:00Z" // Soft deleted!
    }
  ];

  const res = calculatePersonalReimbursements({
    members,
    expenses,
    settlements: [],
    currentUserId: "user-me"
  });

  assert.equal(res.length, 0);

  const breakdown = calculateCategoryBreakdown(expenses);
  assert.equal(breakdown.length, 0);
});

test("room breakdown calculates totals correctly and handles unassigned transactions", () => {
  const rooms = [
    { id: "room-1", name: "Kitchen", icon: "utensils" },
    { id: "room-2", name: "Living Room", icon: "tv" }
  ];

  const expenses = [
    { id: "e1", amount: 500, room_id: "room-1", paid_by: "user-1" },
    { id: "e2", amount: 350.50, room_id: "room-1", paid_by: "user-2" },
    { id: "e3", amount: 1200, room_id: "room-2", paid_by: "user-1" },
    { id: "e4", amount: 150, room_id: null, paid_by: "user-1" } // unassigned
  ];

  const breakdown = calculateRoomBreakdown(expenses, rooms);
  assert.equal(breakdown.length, 3);

  // Highest spending first: Living Room (1200)
  assert.equal(breakdown[0].name, "Living Room");
  assert.equal(breakdown[0].total, 1200);
  assert.equal(breakdown[0].count, 1);
  assert.equal(breakdown[0].peopleCount, 1);

  // Next: Kitchen (850.50 with 2 distinct people)
  assert.equal(breakdown[1].name, "Kitchen");
  assert.equal(breakdown[1].total, 850.50);
  assert.equal(breakdown[1].count, 2);
  assert.equal(breakdown[1].peopleCount, 2);

  // Unassigned: 150
  assert.equal(breakdown[2].name, "Unassigned");
  assert.equal(breakdown[2].total, 150);
  assert.equal(breakdown[2].count, 1);
  assert.equal(breakdown[2].peopleCount, 1);
});

test("budget status correctly identifies near and exceeded thresholds", () => {
  const budgets = [
    { id: "b1", category: "groc", monthly_limit: 1000 },
    { id: "b2", category: "fun", monthly_limit: 500 }
  ];

  const expenses = [
    { id: "e1", category: "groc", amount: 850 }, // 85% -> near limit
    { id: "e2", category: "fun", amount: 600 }   // 120% -> exceeded
  ];

  const status = calculateBudgetStatus(budgets, expenses);
  const groc = status.find(s => s.category === "groc");
  const fun = status.find(s => s.category === "fun");

  assert.equal(groc.spent, 850);
  assert.equal(groc.remaining, 150);
  assert.equal(groc.isNear, true);
  assert.equal(groc.isExceeded, false);

  assert.equal(fun.spent, 600);
  assert.equal(fun.remaining, 0);
  assert.equal(fun.isExceeded, true);
});
