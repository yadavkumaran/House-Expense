import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createSupabaseConfigSource, prepareSupabaseConfig } from "../scripts/supabase-config.mjs";

async function importConfigSource(source) {
  const root = await mkdtemp(join(tmpdir(), "hearth-config-module-"));
  try {
    await writeFile(join(root, "package.json"), '{"type":"module"}', "utf8");
    const file = join(root, "supabase-config.js");
    await writeFile(file, source, "utf8");
    return await import(`${pathToFileURL(file).href}?test=${randomUUID()}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("generates a module with the expected named exports", async () => {
  const source = createSupabaseConfigSource({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_ANON_KEY: "public-anon-key"
  });
  const config = await importConfigSource(source);

  assert.equal(config.SUPABASE_URL, "https://project.supabase.co");
  assert.equal(config.SUPABASE_ANON_KEY, "public-anon-key");
});

test("fails clearly when either required build variable is missing", () => {
  assert.throws(
    () => createSupabaseConfigSource({ SUPABASE_URL: "https://project.supabase.co" }),
    /Missing required build environment variable\(s\): SUPABASE_ANON_KEY/
  );
  assert.throws(
    () => createSupabaseConfigSource({ SUPABASE_ANON_KEY: "public-anon-key" }),
    /Missing required build environment variable\(s\): SUPABASE_URL/
  );
  assert.throws(
    () => createSupabaseConfigSource({}),
    /SUPABASE_URL, SUPABASE_ANON_KEY/
  );
});

test("safely serializes special characters in environment values", async () => {
  const url = `https://project.supabase.co/"quoted"\\path\n\u2028tail`;
  const anonKey = `public-"key"\\with\nspecial\u2028characters`;
  const source = createSupabaseConfigSource({ SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey });
  const config = await importConfigSource(source);

  assert.equal(config.SUPABASE_URL, url);
  assert.equal(config.SUPABASE_ANON_KEY, anonKey);
  assert.ok(source.includes(JSON.stringify(url)));
  assert.ok(source.includes(JSON.stringify(anonKey)));
});

test("preserves an existing local config without requiring build variables", async () => {
  const root = await mkdtemp(join(tmpdir(), "hearth-config-test-"));
  const output = join(root, "dist");
  const expected = 'export const SUPABASE_URL = "local";\nexport const SUPABASE_ANON_KEY = "local-anon";\n';
  try {
    await writeFile(join(root, "supabase-config.js"), expected, "utf8");
    assert.equal(await prepareSupabaseConfig({ root, output, env: {} }), "local");
    assert.equal(await readFile(join(output, "supabase-config.js"), "utf8"), expected);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generates the config when the local file is absent", async () => {
  const root = await mkdtemp(join(tmpdir(), "hearth-config-test-"));
  const output = join(root, "dist");
  try {
    await writeFile(join(root, "package.json"), '{"type":"module"}', "utf8");
    assert.equal(await prepareSupabaseConfig({
      root,
      output,
      env: { SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "public-anon-key" }
    }), "generated");
    const config = await import(pathToFileURL(join(output, "supabase-config.js")).href);
    assert.equal(config.SUPABASE_URL, "https://project.supabase.co");
    assert.equal(config.SUPABASE_ANON_KEY, "public-anon-key");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails the clean build before writing config when environment values are missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "hearth-config-test-"));
  const output = join(root, "dist");
  try {
    await assert.rejects(
      prepareSupabaseConfig({ root, output, env: { SUPABASE_URL: "https://project.supabase.co" } }),
      /Missing required build environment variable\(s\): SUPABASE_ANON_KEY/
    );
    await assert.rejects(readFile(join(output, "supabase-config.js")), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
