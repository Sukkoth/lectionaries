import { join } from "node:path";
import { DATA_DIR } from "../config";
import { formatLocalizedHeader } from "../utils/localized-date";

export interface DayInfoItem {
  date: string;
  title: string;
  description: string | null;
  seasonColor: string | null;
}

export interface DayInfoFile {
  version?: number;
  dayInfo: DayInfoItem[];
}

export interface ReadingItem {
  date: string;
  order: number;
  version: string;
  section: string;
  reference: string;
  text: string;
}

export interface ReadingsFile {
  version?: number;
  readings: ReadingItem[];
}

export interface ManifestVersion {
  code: string;
  name: string;
  path: string;
}

export interface ManifestLanguage {
  code: string;
  name: string;
  dayInfo: { path: string };
  versions: ManifestVersion[];
}

export interface ManifestYear {
  year: number;
  languages: ManifestLanguage[];
}

export interface Manifest {
  years: ManifestYear[];
}

/**
 * Escapes special HTML characters for Telegram message parsing.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Offsets short title/description text with leading spaces to center it on mobile screens.
 */
function centerText(text: string, targetWidth: number = 36): string {
  const len = text.length;
  if (len >= targetWidth) {
    return text;
  }
  const padding = Math.floor((targetWidth - len) / 2);
  return " ".repeat(padding) + text;
}

/**
 * Transforms scripture XML tags (<v>, <red>) into Telegram HTML formatting without italics.
 */
export function formatScriptureText(rawText: string): string {
  let result = rawText.replace(
    /<v>([\d\s\-\,]+)<\/v>/gi,
    (_match, v) => `<b>[${v.trim()}]</b> `
  );

  result = result.replace(
    /<red>([\s\S]*?)<\/red>/gi,
    (_match, content) => content
  );

  result = result.replace(/<[^>]+>/g, "");

  return result.replace(/\s+/g, " ").trim();
}

/**
 * Loads the manifest catalog to locate dayInfo, languages, and translation versions.
 */
export async function loadManifest(): Promise<Manifest | null> {
  try {
    const file = Bun.file(join(DATA_DIR, "manifest.json"));
    if (!(await file.exists())) {
      return null;
    }
    return (await file.json()) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Builds the daily message payload according to the updated format specifications.
 */
export async function buildDailyMessage(
  dateStr: string,
  languageCode: string = "en",
  versionCode: string = "esv"
): Promise<{ text: string; hasContent: boolean }> {
  const manifest = await loadManifest();
  if (!manifest || manifest.years.length === 0) {
    return {
      text: "Lectionary catalog is currently unavailable.",
      hasContent: false,
    };
  }

  let matchedLang: ManifestLanguage | null = null;
  let matchedVersion: ManifestVersion | null = null;

  for (const y of manifest.years) {
    for (const lang of y.languages) {
      if (
        lang.code.toLowerCase() === languageCode.toLowerCase() ||
        lang.name.toLowerCase() === languageCode.toLowerCase()
      ) {
        matchedLang = lang;
        matchedVersion =
          lang.versions.find(
            (v) => v.code.toLowerCase() === versionCode.toLowerCase()
          ) ||
          lang.versions[0] ||
          null;
        break;
      }
    }
    if (matchedLang) break;
  }

  if (!matchedLang) {
    const firstYear = manifest.years[0];
    if (firstYear && firstYear.languages[0]) {
      matchedLang = firstYear.languages[0];
      matchedVersion = matchedLang.versions[0] || null;
    }
  }

  if (!matchedLang || !matchedVersion) {
    return {
      text: "No matching language or translation version found.",
      hasContent: false,
    };
  }

  let dayInfoItem: DayInfoItem | null = null;
  try {
    const dayInfoFile = Bun.file(join(DATA_DIR, matchedLang.dayInfo.path));
    if (await dayInfoFile.exists()) {
      const dayInfoData = (await dayInfoFile.json()) as DayInfoFile;
      dayInfoItem =
        dayInfoData.dayInfo.find((d) => d.date === dateStr) || null;
    }
  } catch {
    dayInfoItem = null;
  }

  let readings: ReadingItem[] = [];
  try {
    const readingsFile = Bun.file(join(DATA_DIR, matchedVersion.path));
    if (await readingsFile.exists()) {
      const readingsData = (await readingsFile.json()) as ReadingsFile;
      readings = readingsData.readings
        .filter((r) => r.date === dateStr)
        .sort((a, b) => a.order - b.order);
    }
  } catch {
    readings = [];
  }

  if (!dayInfoItem && readings.length === 0) {
    return {
      text: `No readings scheduled for ${escapeHtml(dateStr)}.`,
      hasContent: false,
    };
  }

  const lines: string[] = [];

  const headerDate = formatLocalizedHeader(
    dateStr,
    matchedLang.code,
    readings.length
  );
  lines.push(`<b>${escapeHtml(headerDate)}</b>`);

  if (dayInfoItem?.title) {
    lines.push(`<b>${centerText(escapeHtml(dayInfoItem.title))}</b>`);
  }

  if (dayInfoItem?.description) {
    lines.push(centerText(escapeHtml(dayInfoItem.description)));
  }

  lines.push("");

  const versionAbbr = matchedVersion.code.toUpperCase();

  if (readings.length >= 3) {
    for (const r of readings) {
      lines.push(`<blockquote>${escapeHtml(r.reference)}</blockquote>`);
    }
  } else if (readings.length > 0) {
    for (const r of readings) {
      const formattedText = formatScriptureText(r.text);
      lines.push(`<blockquote>${formattedText}</blockquote>`);
      lines.push(
        `                                          ${escapeHtml(r.reference)} (${escapeHtml(versionAbbr)})`
      );
      lines.push("");
    }
  }

  const resultText = lines.join("\n").trim();
  return {
    text: resultText,
    hasContent: true,
  };
}
