// House Expense accounting engine
// Implements exact integer minor-unit arithmetic (paise) to prevent IEEE 754 floating-point inaccuracies.

export function toMinorUnits(amount) {
  if (amount == null || amount === "") return 0;
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num) || !Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function fromMinorUnits(units) {
  if (units == null || !Number.isFinite(units)) return 0;
  return Math.round(units) / 100;
}

export function formatCurrency(amount, locale = "en-IN") {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
  return `₹${Number(num || 0).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function addCurrency(a, b) {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));
}

export function subtractCurrency(a, b) {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

export function calculateExpenseTotal(expenses = []) {
  const totalMinorUnits = expenses
    .filter(expense => !expense.deleted_at)
    .reduce((sum, expense) => sum + toMinorUnits(expense.amount), 0);
  return fromMinorUnits(totalMinorUnits);
}

/**
 * Calculates personal pocket reimbursement balances for each household member.
 *
 * Rules:
 * - Only expenses with funding === 'personal' create an advance liability for the household.
 * - Expenses with funding === 'shared' are paid from common pool and create ZERO personal liability.
 * - Settlements recorded from member A to member B reduce the liability owed to member B.
 * - Reversing or deleting a settlement restores the liability to member B.
 * - Repayments are NOT household expenses.
 */
export function calculatePersonalReimbursements({ members = [], expenses = [], settlements = [], currentUserId = "" } = {}) {
  const activeExpenses = expenses.filter(e => !e.deleted_at);
  const activeSettlements = settlements.filter(s => !s.deleted_at);

  return members
    .filter(member => member.user_id !== currentUserId)
    .map(member => {
      // Total personal-pocket expenses paid by this other member
      const paidPaise = activeExpenses
        .filter(e => e.paid_by === member.user_id && e.funding === "personal")
        .reduce((sum, e) => sum + toMinorUnits(e.amount), 0);

      // Total reimbursements paid by current user to this member
      const repaidPaise = activeSettlements
        .filter(s => s.to_user === member.user_id && s.from_user === currentUserId)
        .reduce((sum, s) => sum + toMinorUnits(s.amount), 0);

      // Reimbursements paid by this member back to current user (if any cross-settlement)
      const receivedBackPaise = activeSettlements
        .filter(s => s.to_user === currentUserId && s.from_user === member.user_id)
        .reduce((sum, s) => sum + toMinorUnits(s.amount), 0);

      const netRepaidPaise = Math.max(0, repaidPaise - receivedBackPaise);
      const outstandingPaise = Math.max(0, paidPaise - netRepaidPaise);

      return {
        member,
        paid: fromMinorUnits(paidPaise),
        repaid: fromMinorUnits(netRepaidPaise),
        outstanding: fromMinorUnits(outstandingPaise)
      };
    })
    .filter(item => item.paid > 0 || item.outstanding > 0);
}

/**
 * Calculates category-wise total spending in minor units.
 */
export function calculateCategoryBreakdown(expenses = []) {
  const active = expenses.filter(e => !e.deleted_at);
  const totals = new Map();
  for (const e of active) {
    const current = totals.get(e.category) || 0;
    totals.set(e.category, current + toMinorUnits(e.amount));
  }
  return [...totals.entries()]
    .map(([category, paise]) => [category, fromMinorUnits(paise)])
    .sort((a, b) => b[1] - a[1]);
}

/**
 * Calculates room-wise total spending.
 */
export function calculateRoomBreakdown(expenses = [], rooms = []) {
  const active = expenses.filter(e => !e.deleted_at);
  const roomMap = new Map(rooms.map(r => [r.id, r]));
  const totals = new Map();

  for (const e of active) {
    const key = e.room_id || "unassigned";
    const current = totals.get(key) || { count: 0, paise: 0, payers: new Set() };
    if (e.paid_by) current.payers.add(e.paid_by);
    totals.set(key, {
      count: current.count + 1,
      paise: current.paise + toMinorUnits(e.amount),
      payers: current.payers
    });
  }

  const result = [];
  for (const [roomId, data] of totals) {
    const room = roomMap.get(roomId);
    result.push({
      roomId: roomId === "unassigned" ? null : roomId,
      name: room ? room.name : "Unassigned",
      icon: room ? room.icon : "home",
      count: data.count,
      peopleCount: data.payers.size,
      total: fromMinorUnits(data.paise)
    });
  }
  return result.sort((a, b) => b.total - a.total);
}

/**
 * Calculates budget health per category.
 */
export function calculateBudgetStatus(budgets = [], expenses = []) {
  const active = expenses.filter(e => !e.deleted_at);
  const categorySpending = new Map();
  for (const e of active) {
    categorySpending.set(e.category, (categorySpending.get(e.category) || 0) + toMinorUnits(e.amount));
  }

  return budgets.map(b => {
    const spentPaise = categorySpending.get(b.category) || 0;
    const limitPaise = toMinorUnits(b.monthly_limit);
    const spent = fromMinorUnits(spentPaise);
    const limit = fromMinorUnits(limitPaise);
    const remaining = fromMinorUnits(Math.max(0, limitPaise - spentPaise));
    const percent = limitPaise > 0 ? Math.min(100, Math.round((spentPaise / limitPaise) * 100)) : 0;
    const isExceeded = spentPaise >= limitPaise;
    const isNear = !isExceeded && spentPaise >= limitPaise * 0.8;

    return {
      id: b.id,
      category: b.category,
      monthly_limit: limit,
      spent,
      remaining,
      percent,
      isExceeded,
      isNear
    };
  });
}
