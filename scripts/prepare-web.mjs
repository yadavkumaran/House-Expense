import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareSupabaseConfig } from "./supabase-config.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");
const files = [
  "index.html",
  "app.js",
  "apk-updater.js",
  "accounting.js",
  "query-results.js",
  "household-permissions.js",
  "ui-preferences.js",
  "voice.js",
  "pwa.js",
  "service-worker.js",
  "styles.css",
  "manifest.webmanifest"
];

await mkdir(output, { recursive: true });
await prepareSupabaseConfig({ root, output });

for (const file of files) {
  try {
    await copyFile(join(root, file), join(output, file));
  } catch (error) {
    throw new Error(`Could not prepare ${file} for Android packaging: ${error.message}`, { cause: error });
  }
}

for (const file of ["calendar.js", "calendar.css"]) {
  const destination = join(output, "calendar-feature", file);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await copyFile(join(root, "calendar-feature", file), destination);
  } catch (error) {
    throw new Error(`Could not prepare calendar-feature/${file} for Android packaging: ${error.message}`, { cause: error });
  }
}

for (const icon of ["hearth-logo.png", "hearth-mark.png", "hearth-192.png", "hearth-512.png", "hearth-maskable-512.png"]) {
  const destination = join(output, "icons", icon);
  await mkdir(dirname(destination), { recursive: true });
  try {
    await copyFile(join(root, "icons", icon), destination);
  } catch (error) {
    throw new Error(`Could not prepare icons/${icon} for Android packaging: ${error.message}`, { cause: error });
  }
}

console.log("Prepared House Expense web assets in dist/.");
