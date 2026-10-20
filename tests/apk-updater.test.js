import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CURRENT_APP_VERSION,
  GITHUB_RELEASES_API,
  getApkReleaseUpdate
} from "../apk-updater.js";

test("latest release resolves a newer APK with a supported GitHub release URL", () => {
  const update = getApkReleaseUpdate({
    tag_name: "v1.3.0",
    draft: false,
    prerelease: false,
    html_url: "https://github.com/yadavkumaran/Hearth/releases/tag/v1.3.0",
    assets: [{
      name: "app-debug.apk",
      browser_download_url: "https://github.com/yadavkumaran/Hearth/releases/download/v1.3.0/app-debug.apk"
    }]
  });

  assert.equal(update.hasUpdate, true);
  assert.equal(update.version, "1.3.0");
  assert.equal(update.downloadUrl.endsWith("/app-debug.apk"), true);
});

test("latest version is not offered as an update", () => {
  const update = getApkReleaseUpdate({
    tag_name: `v${CURRENT_APP_VERSION}`,
    draft: false,
    prerelease: false
  });

  assert.deepEqual(update, { hasUpdate: false, version: CURRENT_APP_VERSION });
});

test("updater version matches the native Android package version", async () => {
  const gradle = await readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8");
  assert.match(gradle, new RegExp(`versionName "${CURRENT_APP_VERSION.replaceAll(".", "\\.")}"`));
});

test("invalid releases and APK URLs fail explicitly", () => {
  assert.equal(GITHUB_RELEASES_API, "https://api.github.com/repos/yadavkumaran/Hearth/releases/latest");
  assert.throws(
    () => getApkReleaseUpdate({ tag_name: "not-a-version", draft: false, prerelease: false }),
    /Invalid app release version/
  );
  assert.throws(
    () => getApkReleaseUpdate({
      tag_name: "v1.3.0",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/yadavkumaran/Hearth/releases/tag/v1.3.0",
      assets: [{ name: "app-debug.apk", browser_download_url: "https://example.com/app-debug.apk" }]
    }),
    /does not contain one valid/
  );
});
