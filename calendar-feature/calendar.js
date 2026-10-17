const COPY = {
  en: {
    title: "Spending calendar",
    month: "Month",
    monthTotal: "Month total",
    dayTotal: "Day total",
    daysWithSpending: "days with spending",
    noExpenses: "No expenses recorded for this month.",
    selectDay: "Select a date to see its expenses.",
    noDayExpenses: "No expenses on this date.",
    expenseCount: count => `${count} ${count === 1 ? "expense" : "expenses"}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  },
  ta: {
    title: "செலவு நாள்காட்டி",
    month: "மாதம்",
    monthTotal: "மாத மொத்தம்",
    dayTotal: "நாள் மொத்தம்",
    daysWithSpending: "செலவு செய்த நாட்கள்",
    noExpenses: "இந்த மாதத்தில் செலவுகள் பதிவு செய்யப்படவில்லை.",
    selectDay: "செலவுகளைப் பார்க்க ஒரு தேதியைத் தேர்ந்தெடுக்கவும்.",
    noDayExpenses: "இந்த நாளில் செலவுகள் இல்லை.",
    expenseCount: count => `${count} செலவுகள்`,
    weekday: ["ஞா", "தி", "செ", "பு", "வி", "வெ", "ச"]
  }
};

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

export function localMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeMonthKey(month) {
  if (typeof month === "string") {
    const trimmed = month.trim();
    if (/^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/.test(trimmed)) {
      return trimmed.slice(0, 7);
    }
    return trimmed;
  }
  if (month instanceof Date && !isNaN(month.getTime())) {
    return localMonthKey(month);
  }
  return typeof month === "undefined" || month === null ? localMonthKey() : String(month);
}

function parseMonthKey(month) {
  const normalized = normalizeMonthKey(month);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) throw new RangeError("Month must be in YYYY-MM format.");
  const [year, monthNumber] = normalized.split("-").map(Number);
  return { year, monthIndex: monthNumber - 1 };
}

function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function aggregateExpensesByDay(expenses, month) {
  const normMonth = normalizeMonthKey(month);
  const { year, monthIndex } = parseMonthKey(normMonth);
  const totals = new Map();
  for (const expense of expenses) {
    if (expense.deleted_at || typeof expense.occurred_on !== "string" ||
        !expense.occurred_on.startsWith(`${normMonth}-`)) continue;
    const day = Number(expense.occurred_on.slice(-2));
    const date = new Date(year, monthIndex, day);
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) continue;
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const current = totals.get(expense.occurred_on) || { totalMinor: 0, expenses: [] };
    current.totalMinor += Math.round(amount * 100);
    current.expenses.push(expense);
    totals.set(expense.occurred_on, current);
  }
  return new Map([...totals].map(([day, value]) => [day, {
    total: value.totalMinor / 100,
    count: value.expenses.length,
    expenses: value.expenses
  }]));
}

function currency(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function compactCurrency(value, locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "INR",
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0
  }).format(value);
}

function monthLabel(year, monthIndex, locale) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })
    .format(new Date(year, monthIndex, 1));
}

function weekdayLabels(locale) {
  return Array.from({ length: 7 }, (_, weekday) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2023, 0, 1 + weekday))
  );
}

export function renderExpenseCalendar({
  expenses = [],
  month = localMonthKey(),
  locale = "en-IN",
  selectedDate = "",
  minMonth = "0001-01",
  maxMonth = "9999-12"
} = {}) {
  const normMonth = normalizeMonthKey(month);
  const normMin = normalizeMonthKey(minMonth);
  const normMax = normalizeMonthKey(maxMonth);
  parseMonthKey(normMin);
  parseMonthKey(normMax);
  if (normMin > normMax) throw new RangeError("Minimum month must not be after maximum month.");
  if (normMonth < normMin || normMonth > normMax) throw new RangeError("Selected month is outside the available range.");
  const { year, monthIndex } = parseMonthKey(normMonth);
  const copy = locale.toLowerCase().startsWith("ta") ? COPY.ta : COPY.en;
  const daily = aggregateExpensesByDay(expenses, normMonth);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const cellCount = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const monthTotal = [...daily.values()].reduce((sum, value) => sum + value.total, 0);
  const selected = selectedDate && selectedDate.startsWith(`${normMonth}-`) && Number(selectedDate.slice(-2)) <= daysInMonth
    ? selectedDate : "";
  const dayDetails = selected ? daily.get(selected) : null;

  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - startWeekday + 1;
    if (day < 1 || day > daysInMonth) return `<span class="expense-calendar__empty" aria-hidden="true"></span>`;
    const date = dateKey(year, monthIndex, day);
    const record = daily.get(date);
    const label = new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(year, monthIndex, day));
    const amount = record ? currency(record.total, locale) : "";
    return `<button class="expense-calendar__day${record ? " has-spending" : ""}${date === selected ? " is-selected" : ""}"
        type="button" data-action="calendar-day" data-calendar-day="${date}" data-value="${date}" aria-pressed="${date === selected}"
        aria-label="${escapeHtml(`${label}${record ? `, ${amount}, ${copy.expenseCount(record.count)}` : `, ${copy.noDayExpenses}`}`)}"
        title="${escapeHtml(record ? `${amount} · ${copy.expenseCount(record.count)}` : copy.noDayExpenses)}">
      <span class="expense-calendar__date">${day}</span>
      <span class="expense-calendar__amount">${record ? escapeHtml(compactCurrency(record.total, locale)) : "—"}</span>
      ${record ? `<span class="expense-calendar__count">${record.count}</span>` : ""}
    </button>`;
  }).join("");

  const detailContent = dayDetails
    ? `<div class="expense-calendar__day-total"><span>${escapeHtml(copy.dayTotal)}</span><strong>${escapeHtml(currency(dayDetails.total, locale))}</strong></div>
      <ul class="expense-calendar__expense-list">${dayDetails.expenses.map(expense =>
      `<li><span>${escapeHtml(expense.description || (copy === COPY.ta ? "செலவு" : "Expense"))}</span><strong>${escapeHtml(currency(Number(expense.amount), locale))}</strong></li>`
    ).join("")}</ul>`
    : selected ? `<p class="expense-calendar__empty-state">${copy.noDayExpenses}</p>`
      : `<p class="expense-calendar__empty-state">${copy.selectDay}</p>`;

  return `<section class="expense-calendar" aria-labelledby="expense-calendar-title">
    <header class="expense-calendar__header">
      <div><p class="expense-calendar__eyebrow">${escapeHtml(copy.title)}</p>
        <h1 id="expense-calendar-title">${escapeHtml(monthLabel(year, monthIndex, locale))}</h1></div>
      <label class="expense-calendar__month-label">${escapeHtml(copy.month)}
        <input class="expense-calendar__month-input" type="month" data-calendar-month value="${normMonth}"
          min="${normMin}" max="${normMax}" aria-label="${escapeHtml(copy.month)}">
      </label>
    </header>
    <div class="expense-calendar__summary">
      <span>${escapeHtml(copy.monthTotal)}</span><strong>${escapeHtml(currency(monthTotal, locale))}</strong>
      <span class="expense-calendar__days-count">${daily.size} ${escapeHtml(copy.daysWithSpending)}</span>
    </div>
    ${daily.size ? "" : `<p class="expense-calendar__notice">${escapeHtml(copy.noExpenses)}</p>`}
    <div class="expense-calendar__grid" role="grid" aria-label="${escapeHtml(monthLabel(year, monthIndex, locale))}">
      ${weekdayLabels(locale).map((label, weekday) => `<span class="expense-calendar__weekday" role="columnheader" aria-label="${escapeHtml(new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2023, 0, 1 + weekday)))}">${escapeHtml(label)}</span>`).join("")}
      ${cells}
    </div>
    <section class="expense-calendar__details" aria-live="polite" aria-atomic="true">
      ${selected ? `<h2>${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(year, monthIndex, Number(selected.slice(-2)))))}</h2>` : ""}
      ${detailContent}
    </section>
  </section>`;
}

export function mountExpenseCalendar(container, options = {}) {
  if (!container || typeof container.addEventListener !== "function") {
    throw new TypeError("Calendar needs a DOM container element.");
  }
  const expenses = options.expenses || [];
  const locale = options.locale || "en-IN";
  let month = normalizeMonthKey(options.month || localMonthKey());
  const minMonth = normalizeMonthKey(options.minMonth || "0001-01");
  const maxMonth = normalizeMonthKey(options.maxMonth || "9999-12");
  parseMonthKey(month);
  parseMonthKey(minMonth);
  parseMonthKey(maxMonth);
  if (minMonth > maxMonth || month < minMonth || month > maxMonth) {
    throw new RangeError("Calendar month range is invalid.");
  }
  let selectedDate = "";

  const render = () => {
    container.innerHTML = renderExpenseCalendar({ expenses, month, locale, selectedDate, minMonth, maxMonth });
  };
  const handleChange = event => {
    if (event.target.matches("[data-calendar-month]")) {
      const val = normalizeMonthKey(event.target.value);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(val) ||
          val < minMonth || val > maxMonth) {
        render();
        return;
      }
      month = val;
      selectedDate = "";
      render();
    }
  };
  const handleClick = event => {
    const day = event.target.closest("[data-calendar-day]");
    if (!day || !container.contains(day)) return;
    selectedDate = day.dataset.calendarDay;
    render();
    container.querySelector(`[data-calendar-day="${selectedDate}"]`)?.focus();
  };

  container.addEventListener("change", handleChange);
  container.addEventListener("click", handleClick);
  render();

  return () => {
    container.removeEventListener("change", handleChange);
    container.removeEventListener("click", handleClick);
    container.replaceChildren();
  };
}
