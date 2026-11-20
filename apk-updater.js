import { CURRENT_APP_VERSION } from "./version.js";
export { CURRENT_APP_VERSION };
export const GITHUB_RELEASES_API = "https://api.github.com/repos/yadavkumaran/House-Expense/releases/latest";

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value || "").trim());
  if (!match) throw new Error(`Invalid app release version: ${value}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

export function getApkReleaseUpdate(release, currentVersion = CURRENT_APP_VERSION) {
  if (!release || release.draft || release.prerelease || typeof release.tag_name !== "string") {
    throw new Error("The latest GitHub release is not a published stable release.");
  }

  const version = release.tag_name.replace(/^v/i, "");
  const hasUpdate = compareVersions(version, currentVersion) > 0;
  if (!hasUpdate) return { hasUpdate: false, version };

  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAssets = assets.filter(asset => typeof asset?.name === "string" && /\.apk$/i.test(asset.name));
  const asset = apkAssets.find(candidate => candidate.name.toLowerCase() === "app-debug.apk")
    || (apkAssets.length === 1 ? apkAssets[0] : null);
  const validAssetPrefixes = [
    "https://github.com/yadavkumaran/House-Expense/releases/download/",
    "https://github.com/yadavkumaran/Hearth/releases/download/"
  ];

  if (!asset || typeof asset.browser_download_url !== "string"
    || !validAssetPrefixes.some(prefix => asset.browser_download_url.startsWith(prefix))) {
    throw new Error("The latest release does not contain one valid House Expense APK.");
  }
  const validHtmlPrefixes = [
    "https://github.com/yadavkumaran/House-Expense/releases/tag/",
    "https://github.com/yadavkumaran/Hearth/releases/tag/"
  ];
  if (typeof release.html_url !== "string"
    || !validHtmlPrefixes.some(prefix => release.html_url.startsWith(prefix))) {
    throw new Error("The latest release page URL is invalid.");
  }

  return {
    hasUpdate: true,
    version,
    downloadUrl: asset.browser_download_url
  };
}
