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

export interface VerseIntegrityError {
  file: string;
  date: string;
  readingOrder: number;
  section: string;
  reference: string;
  type: "numeric_overlap" | "duplicate_text";
  error: string;
}

describe("Scripture Verse Integrity Validation Suite", async () => {
  const manifestPath = join("data", "manifest.json");
  const manifestFile = Bun.file(manifestPath);
  const manifest = (await manifestFile.json()) as Manifest;

  for (const yearObj of manifest.years) {
    for (const langObj of yearObj.languages) {
      for (const verObj of langObj.versions) {
        const relPath = verObj.path;
        const fullPath = join("data", relPath);

        test(`Verse Integrity: ${langObj.name} [${langObj.code}] | Version: ${verObj.name} [${verObj.code}]`, async () => {
          const file = Bun.file(fullPath);
          const data = (await file.json()) as ReadingsFile;
          const integrityErrors: VerseIntegrityError[] = [];

          for (const reading of data.readings) {
            const text = reading.text || "";
            const matches = [
              ...text.matchAll(
                /<v>([\d\s\-\,]+)<\/v>([\s\S]*?)(?=(?:<v>[\d\s\-\,]+<\/v>|$))/g
              ),
            ];

            const verseMap = new Map<number, string[]>();
            const tagTextEntries: {
              tag: string;
              verses: number[];
              normText: string;
              rawText: string;
            }[] = [];

            for (const match of matches) {
              const rawTag = (match[1] ?? "").trim();
              const rawText = (match[2] ?? "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim();
              const normText = rawText.toLowerCase();

              const parts = rawTag.split("-");
              const startStr = parts[0] ?? "";
              const endStr = parts[1] ?? startStr;
              const start = Number.parseInt(startStr, 10);
              const end = Number.parseInt(endStr, 10);
              const verses: number[] = [];

              if (!Number.isNaN(start)) {
                for (
                  let v = start;
                  v <= (Number.isNaN(end) ? start : end);
                  v++
                ) {
                  verses.push(v);
                  if (!verseMap.has(v)) {
                    verseMap.set(v, []);
                  }
                  verseMap.get(v)?.push(`<v>${rawTag}</v>`);
                }
              }

              tagTextEntries.push({
                tag: `<v>${rawTag}</v>`,
                verses,
                normText,
                rawText,
              });
            }

            // Check 1: Numeric Verse Range Overlap
            for (const [verseNum, tags] of verseMap.entries()) {
              if (tags.length > 1) {
                integrityErrors.push({
                  file: relPath,
                  date: reading.date,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: reading.reference,
                  type: "numeric_overlap",
                  error: `Verse ${verseNum} appears in multiple overlapping tags: ${tags.join(", ")}`,
                });
              }
            }

            // Check 2: Duplicate Verse Text Content (between overlapping or adjacent tags)
            for (let i = 0; i < tagTextEntries.length; i++) {
              for (let j = i + 1; j < tagTextEntries.length; j++) {
                const entryA = tagTextEntries[i];
                const entryB = tagTextEntries[j];

                if (!entryA || !entryB) continue;

                const isAdjacentOrOverlap =
                  j === i + 1 ||
                  entryA.verses.some((v) => entryB.verses.includes(v));

                if (
                  isAdjacentOrOverlap &&
                  entryA.normText.length >= 10 &&
                  entryA.normText === entryB.normText
                ) {
                  integrityErrors.push({
                    file: relPath,
                    date: reading.date,
                    readingOrder: reading.order,
                    section: reading.section,
                    reference: reading.reference,
                    type: "duplicate_text",
                    error: `Duplicate verse text content detected between ${entryA.tag} and ${entryB.tag}: "${entryA.rawText.slice(0, 50)}..."`,
                  });
                }
              }
            }
          }

          expect(integrityErrors).toEqual([]);
        });
      }
    }
  }
});
