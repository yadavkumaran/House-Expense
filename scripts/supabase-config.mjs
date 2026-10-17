import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function createSupabaseConfigSource(env) {
  const url = typeof env.SUPABASE_URL === "string" ? env.SUPABASE_URL.trim() : "";
  const anonKey = typeof env.SUPABASE_ANON_KEY === "string" ? env.SUPABASE_ANON_KEY.trim() : "";
  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!anonKey) missing.push("SUPABASE_ANON_KEY");
  if (missing.length) {
    throw new Error(`Missing required build environment variable(s): ${missing.join(", ")}.`);
  }

  return [
    `export const SUPABASE_URL = ${JSON.stringify(url)};`,
    `export const SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};`,
    ""
  ].join("\n");
}

export async function prepareSupabaseConfig({ root, output, env = process.env }) {
  const localConfig = join(root, "supabase-config.js");
  const outputConfig = join(output, "supabase-config.js");
  await mkdir(output, { recursive: true });

  try {
    await copyFile(localConfig, outputConfig);
    return "local";
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Could not copy local supabase-config.js: ${error.message}`, { cause: error });
    }
  }

  const source = createSupabaseConfigSource(env);
  await writeFile(outputConfig, source, "utf8");
  return "generated";
}
