import test from "node:test";
import assert from "node:assert/strict";
import { aggregateExpensesByDay, localMonthKey, renderExpenseCalendar } from "./calendar.js";

const expenses = [
  { id: "a", occurred_on: "2026-10-03", amount: 120.1, description: "Milk" },
  { id: "b", occurred_on: "2026-10-03", amount: 29.9, description: "Bread" },
  { id: "c", occurred_on: "2026-10-17", amount: 800, description: "Electricity" },
  { id: "d", occurred_on: "2026-09-30", amount: 500, description: "Previous month" },
  { id: "e", occurred_on: "2026-10-17", amount: 1000, description: "Deleted", deleted_at: "2026-10-18" }
];

test("creates local month keys without UTC date shifts", () => {
  assert.equal(localMonthKey(new Date(2026, 9, 17)), "2026-10");
});

test("aggregates only valid, active expenses in the selected month using paise precision", () => {
  const daily = aggregateExpensesByDay(expenses, "2026-10");
  assert.equal(daily.size, 2);
  assert.deepEqual(daily.get("2026-10-03"), {
    total: 150,
    count: 2,
    expenses: expenses.slice(0, 2)
  });
  assert.equal(daily.get("2026-10-17").total, 800);
  assert.equal(daily.get("2026-10-17").count, 1);
  assert.equal(aggregateExpensesByDay(expenses, "2026-09").get("2026-09-30").total, 500);
});

test("rejects invalid month keys rather than rendering a misleading calendar", () => {
  assert.throws(() => aggregateExpensesByDay(expenses, "2026-13"), RangeError);
  assert.throws(() => renderExpenseCalendar({ expenses, month: "October 2026" }), RangeError);
  assert.throws(() => renderExpenseCalendar({
    expenses, month: "2026-09", minMonth: "2026-10", maxMonth: "2026-10"
  }), RangeError);
});

test("accepts and normalizes YYYY-MM-DD date strings without throwing RangeError", () => {
  const html = renderExpenseCalendar({ expenses, month: "2026-10-01" });
  assert.match(html, /data-calendar-month value="2026-10"/);
});

test("renders every date with its daily amount and selected-day expense details", () => {
  const html = renderExpenseCalendar({
    expenses,
    month: "2026-10",
    locale: "en-IN",
    selectedDate: "2026-10-03",
    minMonth: "2025-11",
    maxMonth: "2026-10"
  });
  assert.match(html, /type="month" data-calendar-month value="2026-10"/);
  assert.match(html, /min="2025-11" max="2026-10"/);
  assert.match(html, /data-calendar-day="2026-10-03"/);
  assert.match(html, /data-calendar-day="2026-10-31"/);
  assert.match(html, /₹150/);
  assert.match(html, /Day total/);
  assert.match(html, /₹150\.00/);
  assert.match(html, /Milk/);
  assert.match(html, /Bread/);
  assert.match(html, /₹950/);
});

test("escapes descriptions and renders an empty month state", () => {
  const empty = renderExpenseCalendar({ expenses: [], month: "2026-10" });
  assert.match(empty, /No expenses recorded for this month\./);

  const html = renderExpenseCalendar({
    expenses: [{ occurred_on: "2026-10-09", amount: 50, description: "<img src=x onerror=alert(1)>" }],
    month: "2026-10",
    selectedDate: "2026-10-09"
  });
  assert.doesNotMatch(html, /No expenses recorded for this month\./);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test("uses compact amounts in narrow calendar cells and exact totals in day details", () => {
  const html = renderExpenseCalendar({
    expenses: [{ occurred_on: "2026-10-09", amount: 1234.5, description: "Large purchase" }],
    month: "2026-10",
    selectedDate: "2026-10-09"
  });
  assert.match(html, /₹1\.2K/);
  assert.match(html, /₹1,234\.50/);
});
