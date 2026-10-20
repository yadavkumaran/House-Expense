# Isolated expense calendar feature

The calendar is integrated into House Expense's More menu. The standalone preview remains at `preview.html`; its clearly labelled sample transactions are illustrative and are not connected to Supabase.

## Interface

Import `mountExpenseCalendar` from `calendar.js` and `calendar.css`. Pass the current household's already-loaded expense rows (with `occurred_on`, `amount`, and `description`), the selected `YYYY-MM` month, and the active locale:

```js
import { mountExpenseCalendar } from "./calendar-feature/calendar.js";
import "./calendar-feature/calendar.css";

const unmount = mountExpenseCalendar(container, {
  expenses: currentHouseholdExpenses,
  month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
  locale: "en-IN"
});
```

The month control filters the supplied rows; clicking a date lists that day's actual expense descriptions and amounts. The caller owns data loading and should provide rows for every month it wants to browse. The app currently supplies its active household's rolling 12-month expense data and bounds month navigation to that range. The returned cleanup function removes listeners and clears the component.

Run isolated tests with:

```powershell
node --test calendar-feature\calendar.test.js
```
