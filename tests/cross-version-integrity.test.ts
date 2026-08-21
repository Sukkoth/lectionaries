import { describe, expect, test } from "bun:test";
import { join } from "node:path";

interface ManifestVersion {
  code: string;
  name: string;
  path: string;
}

interface ManifestLanguage {
  name: string;
  code: string;
  versions: ManifestVersion[];
}

interface ManifestYear {
  year: number;
  languages: ManifestLanguage[];
}

interface Manifest {
  years: ManifestYear[];
}

interface ReadingItem {
  date: string;
  order: number;
  section: string;
  reference: string;
  text: string;
}

interface ReadingsFile {
  readings: ReadingItem[];
}

interface BookInfo {
  order: number;
  name: string;
}

interface VersionData {
  versionCode: string;
  versionName: string;
  books: BookInfo[];
}

interface ParsedRef {
  versionCode: string;
  versionName: string;
  language: string;
  rawReference: string;
  canonicalOrder: number | null;
  chapter: number;
  startVerse: number | null;
  endVerse: number | null;
}

export interface CrossVersionError {
  year: number;
  date: string;
  readingOrder: number;
  section: string;
  type: "book_mismatch" | "chapter_mismatch" | "verse_mismatch";
  error: string;
}

export interface CrossVersionWarning {
  warningType: "concatenated_verse_range";
  year: number;
  date: string;
  readingOrder: number;
  section: string;
  refVersion: {
    code: string;
    name: string;
    language: string;
    reference: string;
    verses: string;
  };
  targetVersion: {
    code: string;
    name: string;
    language: string;
    reference: string;
    verses: string;
  };
}

describe("Cross-Version Scripture Reference Consistency Validation Suite", async () => {
  const versionsData = (await Bun.file(
    "check-point/versions.json"
  ).json()) as Record<string, VersionData>;
  const manifest = (await Bun.file("data/manifest.json").json()) as Manifest;

  // Build version book map: code -> Map<lowerName, order>
  const versionBookMap = new Map<string, Map<string, number>>();
  for (const [key, ver] of Object.entries(versionsData)) {
    const bMap = new Map<string, number>();
    for (const b of ver.books) {
      bMap.set(b.name.trim().toLowerCase(), b.order);
    }
    versionBookMap.set(key, bMap);
    if (ver.versionCode) {
      versionBookMap.set(ver.versionCode, bMap);
    }
  }

  function parseReference(
    ref: string,
    verCode: string,
    verName: string,
    langName: string
  ): ParsedRef | null {
    const match = ref.trim().match(/^(.*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (!match) return null;

    const rawBook = match[1]?.trim() ?? "";
    const chapter = Number.parseInt(match[2] ?? "0", 10);
    const startVerse = match[3] ? Number.parseInt(match[3], 10) : null;
    const endVerse = match[4] ? Number.parseInt(match[4], 10) : startVerse;

    const bMap = versionBookMap.get(verCode) || versionBookMap.get("አማ54");
    const canonicalOrder = bMap
      ? (bMap.get(rawBook.toLowerCase()) ?? null)
      : null;

    return {
      versionCode: verCode,
      versionName: verName,
      language: langName,
      rawReference: ref,
      canonicalOrder,
      chapter,
      startVerse,
      endVerse,
    };
  }

  for (const yearObj of manifest.years) {
    const year = yearObj.year;

    test(`Cross-Version Consistency: Year ${year}`, async () => {
      // Map: "date|order|section" -> ParsedRef[]
      const readingSlotMap = new Map<string, ParsedRef[]>();

      for (const langObj of yearObj.languages) {
        for (const verObj of langObj.versions) {
          const fullPath = join("data", verObj.path);
          const data = (await Bun.file(fullPath).json()) as ReadingsFile;

          for (const r of data.readings) {
            const parsed = parseReference(
              r.reference,
              verObj.code,
              verObj.name,
              langObj.name
            );
            if (!parsed) continue;

            const key = `${r.date}|${r.order}|${r.section.toUpperCase()}`;
            if (!readingSlotMap.has(key)) {
              readingSlotMap.set(key, []);
            }
            readingSlotMap.get(key)?.push(parsed);
          }
        }
      }

      const errors: CrossVersionError[] = [];
      const warnings: CrossVersionWarning[] = [];

      for (const [slotKey, refs] of readingSlotMap.entries()) {
        if (refs.length <= 1) continue;

        const parts = slotKey.split("|");
        const date = parts[0] ?? "";
        const orderStr = parts[1] ?? "0";
        const section = parts[2] ?? "";
        const readingOrder = Number.parseInt(orderStr, 10);

        const refVersion = refs.find((r) => r.versionCode === "esv") || refs[0];
        if (!refVersion) continue;

        for (const target of refs) {
          if (target === refVersion) continue;

          // Check 1: Canonical Book Mismatch (Fatal Error)
          if (
            refVersion.canonicalOrder !== null &&
            target.canonicalOrder !== null &&
            refVersion.canonicalOrder !== target.canonicalOrder
          ) {
            errors.push({
              year,
              date,
              readingOrder,
              section,
              type: "book_mismatch",
              error: `[Book Mismatch] ${refVersion.language} (${refVersion.versionCode}) has book #${refVersion.canonicalOrder} ('${refVersion.rawReference}'), but ${target.language} (${target.versionCode}) has book #${target.canonicalOrder} ('${target.rawReference}')`,
            });
            continue;
          }

          // Check 2: Chapter Mismatch (Fatal Error)
          if (refVersion.chapter !== target.chapter) {
            errors.push({
              year,
              date,
              readingOrder,
              section,
              type: "chapter_mismatch",
              error: `[Chapter Mismatch] ${refVersion.language} (${refVersion.versionCode}) has chapter ${refVersion.chapter} ('${refVersion.rawReference}'), but ${target.language} (${target.versionCode}) has chapter ${target.chapter} ('${target.rawReference}')`,
            });
            continue;
          }

          // Check 3 & 4: Verse Range Comparison
          if (
            refVersion.startVerse !== null &&
            refVersion.endVerse !== null &&
            target.startVerse !== null &&
            target.endVerse !== null
          ) {
            const hasOverlap =
              Math.max(refVersion.startVerse, target.startVerse) <=
              Math.min(refVersion.endVerse, target.endVerse);

            if (!hasOverlap) {
              // Disjoint ranges -> Fatal Error
              errors.push({
                year,
                date,
                readingOrder,
                section,
                type: "verse_mismatch",
                error: `[Obvious Verse Mismatch] ${refVersion.language} (${refVersion.versionCode}) has verses ${refVersion.startVerse}-${refVersion.endVerse} ('${refVersion.rawReference}'), but ${target.language} (${target.versionCode}) has verses ${target.startVerse}-${target.endVerse} ('${target.rawReference}')`,
              });
            } else if (
              refVersion.startVerse !== target.startVerse ||
              refVersion.endVerse !== target.endVerse
            ) {
              // Overlapping concatenated ranges -> Structured Warning
              warnings.push({
                warningType: "concatenated_verse_range",
                year,
                date,
                readingOrder,
                section,
                refVersion: {
                  code: refVersion.versionCode,
                  name: refVersion.versionName,
                  language: refVersion.language,
                  reference: refVersion.rawReference,
                  verses: `${refVersion.startVerse}-${refVersion.endVerse}`,
                },
                targetVersion: {
                  code: target.versionCode,
                  name: target.versionName,
                  language: target.language,
                  reference: target.rawReference,
                  verses: `${target.startVerse}-${target.endVerse}`,
                },
              });
            }
          }
        }
      }

      if (warnings.length > 0) {
        console.log(
          `\n=== STRUCTURED CROSS-VERSION VERSE RANGE WARNINGS (Year ${year}) ===\n` +
            JSON.stringify(warnings, null, 2)
        );
      }

      expect(errors).toEqual([]);
    });
  }
});
