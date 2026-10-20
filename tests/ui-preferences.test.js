import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyUiPreferences,
  DEFAULT_UI_PREFERENCES,
  loadUiPreferences,
  normalizeUiPreferences,
  saveUiPreferences,
  UI_PREFERENCE_KEY
} from "../ui-preferences.js";

function createStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test("appearance preferences default safely and migrate the previous theme choice", () => {
  assert.deepEqual(loadUiPreferences(createStorage()), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(loadUiPreferences(createStorage({ "hearth.theme": "dark" })), {
    ...DEFAULT_UI_PREFERENCES,
    theme: "dark"
  });
});

test("appearance preferences persist only supported settings", () => {
  const storage = createStorage();
  const saved = saveUiPreferences({
    theme: "dark",
    accent: "teal",
    density: "compact",
    motion: "reduced",
    injected: "ignored"
  }, storage);

  assert.deepEqual(saved, {
    theme: "dark",
    accent: "teal",
    density: "compact",
    motion: "reduced"
  });
  assert.deepEqual(JSON.parse(storage.getItem(UI_PREFERENCE_KEY)), saved);
  assert.deepEqual(loadUiPreferences(storage), saved);
});

test("invalid stored preferences fall back to known values", () => {
  assert.deepEqual(normalizeUiPreferences({
    theme: "sepia",
    accent: "injected",
    density: "huge",
    motion: "fast"
  }), DEFAULT_UI_PREFERENCES);
  assert.deepEqual(loadUiPreferences(createStorage({ [UI_PREFERENCE_KEY]: "not-json" })), DEFAULT_UI_PREFERENCES);
});

test("appearance preferences apply theme, accent, density, and reduced-motion choices", () => {
  const originalMatchMedia = globalThis.matchMedia;
  globalThis.matchMedia = query => ({ matches: query.includes("reduced-motion") });
  const root = { dataset: {} };

  try {
    applyUiPreferences({
      theme: "system",
      accent: "rose",
      density: "compact",
      motion: "system"
    }, root, true);

    assert.deepEqual(root.dataset, {
      theme: "dark",
      accent: "rose",
      density: "compact",
      motion: "reduced"
    });

    applyUiPreferences({ ...DEFAULT_UI_PREFERENCES, theme: "light", motion: "full" }, root, true);
    assert.equal(root.dataset.theme, "light");
    assert.equal(root.dataset.motion, "full");
  } finally {
    if (originalMatchMedia) globalThis.matchMedia = originalMatchMedia;
    else delete globalThis.matchMedia;
  }
});

test("offline app shell precaches every application module", async () => {
  const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  for (const moduleName of [
    "apk-updater.js",
    "accounting.js",
    "query-results.js",
    "household-permissions.js",
    "ui-preferences.js",
    "voice.js"
  ]) {
    assert.match(serviceWorker, new RegExp(`\\.\/${moduleName.replace(".", "\\.")}`));
  }
  assert.match(serviceWorker, /hearth-shell-v7/);
});
