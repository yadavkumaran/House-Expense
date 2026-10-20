export const UI_PREFERENCE_KEY = "hearth.uiPreferences";

export const DEFAULT_UI_PREFERENCES = Object.freeze({
  theme: "system",
  accent: "blue",
  density: "comfortable",
  motion: "system"
});

const allowedPreferences = {
  theme: ["system", "light", "dark"],
  accent: ["blue", "teal", "violet", "rose"],
  density: ["comfortable", "compact"],
  motion: ["system", "reduced", "full"]
};

export function normalizeUiPreferences(value = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_UI_PREFERENCES).map(([key, fallback]) => [
    key,
    allowedPreferences[key].includes(value?.[key]) ? value[key] : fallback
  ]));
}

export function loadUiPreferences(storage = globalThis.localStorage) {
  try {
    const saved = storage.getItem(UI_PREFERENCE_KEY);
    if (saved) return normalizeUiPreferences(JSON.parse(saved));
    return normalizeUiPreferences({ theme: storage.getItem("hearth.theme") || "system" });
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function saveUiPreferences(preferences, storage = globalThis.localStorage) {
  const normalized = normalizeUiPreferences(preferences);
  storage.setItem(UI_PREFERENCE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function applyUiPreferences(preferences, root, prefersDark = false) {
  const normalized = normalizeUiPreferences(preferences);
  const mediaQuery = globalThis.matchMedia;
  const prefersReducedMotion = mediaQuery
    ? mediaQuery("(prefers-reduced-motion: reduce)").matches
    : false;
  root.dataset.theme = normalized.theme === "system"
    ? (prefersDark ? "dark" : "light")
    : normalized.theme;
  root.dataset.accent = normalized.accent;
  root.dataset.density = normalized.density;
  root.dataset.motion = normalized.motion === "system"
    ? (prefersReducedMotion ? "reduced" : "full")
    : normalized.motion;
}
