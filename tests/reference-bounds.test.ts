import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DATA_DIR } from "../src/config";

interface BookBounds {
  index: number;
  id: string;
  name: string;
  testament: string;
  chaptersCount: number;
  versesCount: number;
  chapters: number[];
}

interface BibleBoundsData {
  totalBooks: number;
  totalChapters: number;
  totalVerses: number;
  books: BookBounds[];
  byIndex: Record<string, BookBounds>;
}

interface VersionBook {
  order: number;
  usfm: string;
  name: string;
  abbreviation: string;
}

interface VersionInfo {
  versionCode: string;
  versionId: number;
  versionName: string;
  language: string;
  books: VersionBook[];
}

interface ReadingItem {
  date: string;
  order: number;
  version: string;
  section: string;
  reference: string;
  text: string;
}

interface ReadingsFile {
  version?: number;
  readings: ReadingItem[];
}

interface VersionEntry {
  code: string;
  name: string;
  contentVersion: number;
  path: string;
}

interface LanguageEntry {
  code: string;
  name: string;
  versions: VersionEntry[];
}

interface Manifest {
  years: Array<{
    year: number;
    languages: LanguageEntry[];
  }>;
}

interface ReferenceValidationError {
  file: string;
  date: string;
  readingOrder: number;
  section: string;
  reference: string;
  error: string;
}

const boundsFile = Bun.file("check-point/bible-bounds.json");
const versionsFile = Bun.file("check-point/versions.json");
const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));

const boundsData = (await boundsFile.json()) as BibleBoundsData;
const versionsData = (await versionsFile.json()) as Record<string, VersionInfo>;
const manifest = (await manifestFile.json()) as Manifest;

// Standard USFM code normalization map to align 3-letter USFM with bible-bounds.json IDs
const USFM_ALIAS_MAP: Record<string, string> = {
  GEN: "GEN",
  EXO: "EXO",
  LEV: "LEV",
  NUM: "NUM",
  DEU: "DEU",
  JOS: "JOSH",
  JOSH: "JOSH",
  JDG: "JUDG",
  JUDG: "JUDG",
  RUT: "RUTH",
  RUTH: "RUTH",
  "1SA": "1SAM",
  "1SAM": "1SAM",
  "2SA": "2SAM",
  "2SAM": "2SAM",
  "1KI": "1KGS",
  "1KGS": "1KGS",
  "2KI": "2KGS",
  "2KGS": "2KGS",
  "1CH": "1CHR",
  "1CHR": "1CHR",
  "2CH": "2CHR",
  "2CHR": "2CHR",
  EZR: "EZRA",
  EZRA: "EZRA",
  NEH: "NEH",
  EST: "ESTH",
  ESTH: "ESTH",
  JOB: "JOB",
  PSA: "PSA",
  PRO: "PROV",
  PROV: "PROV",
  ECC: "ECCL",
  ECCL: "ECCL",
  SNG: "SONG",
  SONG: "SONG",
  ISA: "ISA",
  JER: "JER",
  LAM: "LAM",
  EZK: "EZEK",
  EZEK: "EZEK",
  DAN: "DAN",
  HOS: "HOS",
  JOL: "JOEL",
  JOEL: "JOEL",
  AMO: "AMOS",
  AMOS: "AMOS",
  OBA: "OBAD",
  OBAD: "OBAD",
  JON: "JONAH",
  JONAH: "JONAH",
  MIC: "MIC",
  NAM: "NAH",
  NAH: "NAH",
  HAB: "HAB",
  ZEP: "ZEPH",
  ZEPH: "ZEPH",
  HAG: "HAGG",
  HAGG: "HAGG",
  ZEC: "ZECH",
  ZECH: "ZECH",
  MAL: "MAL",
  MAT: "MATT",
  MATT: "MATT",
  MRK: "MARK",
  MARK: "MARK",
  LUK: "LUKE",
  LUKE: "LUKE",
  JHN: "JOHN",
  JOHN: "JOHN",
  ACT: "ACTS",
  ACTS: "ACTS",
  ROM: "ROM",
  "1CO": "1COR",
  "1COR": "1COR",
  "2CO": "2COR",
  "2COR": "2COR",
  GAL: "GAL",
  EPH: "EPH",
  PHP: "PHIL",
  PHIL: "PHIL",
  COL: "COL",
  "1TH": "1THESS",
  "1THESS": "1THESS",
  "2TH": "2THESS",
  "2THESS": "2THESS",
  "1TI": "1TIM",
  "1TIM": "1TIM",
  "2TI": "2TIM",
  "2TIM": "2TIM",
  TIT: "TITUS",
  TITUS: "TITUS",
  PHM: "PHILEM",
  PHILEM: "PHILEM",
  HEB: "HEB",
  JAS: "JAS",
  "1PE": "1PET",
  "1PET": "1PET",
  "2PE": "2PET",
  "2PET": "2PET",
  "1JN": "1JOHN",
  "1JOHN": "1JOHN",
  "2JN": "2JOHN",
  "2JOHN": "2JOHN",
  "3JN": "3JOHN",
  "3JOHN": "3JOHN",
  JUD: "JUDE",
  JUDE: "JUDE",
  REV: "REV",
};

// Build USFM lookup map for bible-bounds.json
const boundsByUsfm = new Map<string, BookBounds>();
for (const b of boundsData.books) {
  boundsByUsfm.set(b.id.toUpperCase(), b);
}

function getVersionInfo(verCode: string): VersionInfo | null {
  if (versionsData[verCode]) return versionsData[verCode];
  if (verCode === "am54" && versionsData["አማ54"]) return versionsData["አማ54"];
  return null;
}

/**
 * Resolves raw scripture reference book names STRICTLY against full book names (book.name)
 * or abbreviations (book.abbreviation) registered in check-point/versions.json for that version.
 * No phonetic patches or fuzzy spelling alterations.
 */
function resolveBookUsfmStrict(
  rawBook: string,
  verInfo: VersionInfo | null
): string | null {
  if (!verInfo || !verInfo.books) return null;

  const rawNorm = rawBook.trim().toLowerCase();

  // Sort version books by name length descending so multi-word titles match first
  const sortedBooks = [...verInfo.books].sort(
    (a, b) => b.name.length - a.name.length
  );

  for (const book of sortedBooks) {
    const candName = book.name.trim().toLowerCase();
    const candAbbr = book.abbreviation
      ? book.abbreviation.trim().toLowerCase()
      : "";

    // Match rawBook strictly against book.name or book.abbreviation
    if (
      rawNorm === candName ||
      rawNorm.startsWith(candName + " ") ||
      (candAbbr && (rawNorm === candAbbr || rawNorm.startsWith(candAbbr + " ")))
    ) {
      const code = book.usfm.toUpperCase();
      return USFM_ALIAS_MAP[code] || code;
    }
  }

  return null;
}

describe("Scripture Reference & Bounds Validation Suite", () => {
  for (const yearEntry of manifest.years) {
    for (const lang of yearEntry.languages) {
      for (const ver of lang.versions) {
        describe(`Reference Bounds Check: ${lang.name} [${lang.code}] | Version: ${ver.name} [${ver.code}]`, () => {
          const relativePath = ver.path;
          const filePath = join(DATA_DIR, relativePath);
          const file = Bun.file(filePath);

          test("all readings contain valid scripture book, chapter, and verse references matched strictly against check-point/versions.json", async () => {
            expect(await file.exists()).toBe(true);
            const data = (await file.json()) as ReadingsFile;
            const verInfo = getVersionInfo(ver.code);

            // Fail explicitly if version has no entry in check-point/versions.json
            expect(verInfo).not.toBeNull();
            expect(verInfo?.books).toBeDefined();

            const validationErrors: ReferenceValidationError[] = [];

            for (const reading of data.readings) {
              const ref = reading.reference.trim();

              const match = ref.match(
                /^(.*?)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?$/
              );

              if (!match || !match[1] || !match[2]) {
                validationErrors.push({
                  file: relativePath,
                  date: reading.date,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: ref,
                  error:
                    "Reference regex parsing failed (expected format like 'Book Ch:Verse-Verse' or 'Book Ch')",
                });
                continue;
              }

              const rawBook = match[1].trim();
              const usfmCode = resolveBookUsfmStrict(rawBook, verInfo);

              if (!usfmCode) {
                validationErrors.push({
                  file: relativePath,
                  date: reading.date,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: ref,
                  error: `Unrecognized or misspelled Bible book name '${rawBook}'. Book name does not strictly match registered book names in check-point/versions.json for version '${ver.code}'`,
                });
                continue;
              }

              const bookBounds = boundsByUsfm.get(usfmCode);
              if (!bookBounds) {
                validationErrors.push({
                  file: relativePath,
                  date: reading.date,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: ref,
                  error: `No chapter/verse bounds metadata found for USFM code '${usfmCode}'`,
                });
                continue;
              }

              const startCh = Number.parseInt(match[2], 10);
              let startV = match[3] ? Number.parseInt(match[3], 10) : null;
              let endCh =
                match[4] && match[5] ? Number.parseInt(match[4], 10) : startCh;
              let endV = match[5]
                ? Number.parseInt(match[5], 10)
                : match[4]
                  ? Number.parseInt(match[4], 10)
                  : startV;

              if (bookBounds.chaptersCount === 1 && !match[3]) {
                startV = startCh;
                endCh = 1;
                endV = match[4] ? Number.parseInt(match[4], 10) : startV;
              }

              // Verify start chapter bounds
              if (startCh < 1 || startCh > bookBounds.chaptersCount) {
                validationErrors.push({
                  file: relativePath,
                  date: reading.date,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: ref,
                  error: `Chapter ${startCh} out of bounds for ${bookBounds.name} (${bookBounds.id}). Valid chapters: 1 to ${bookBounds.chaptersCount}`,
                });
                continue;
              }

              // Verify end chapter bounds
              if (endCh < 1 || endCh > bookBounds.chaptersCount) {
                validationErrors.push({
                  file: relativePath,
                  date: relativePath,
                  readingOrder: reading.order,
                  section: reading.section,
                  reference: ref,
                  error: `End Chapter ${endCh} out of bounds for ${bookBounds.name} (${bookBounds.id}). Valid chapters: 1 to ${bookBounds.chaptersCount}`,
                });
                continue;
              }

              // Verify start verse bounds
              if (startV !== null) {
                const maxVerseStart = bookBounds.chapters[startCh - 1];
                if (
                  startV < 1 ||
                  (maxVerseStart !== undefined && startV > maxVerseStart)
                ) {
                  validationErrors.push({
                    file: relativePath,
                    date: reading.date,
                    readingOrder: reading.order,
                    section: reading.section,
                    reference: ref,
                    error: `Start Verse ${startV} out of bounds for ${bookBounds.name} Chapter ${startCh}. Valid verses: 1 to ${maxVerseStart}`,
                  });
                  continue;
                }
              }

              // Verify end verse bounds
              if (endV !== null) {
                const maxVerseEnd = bookBounds.chapters[endCh - 1];
                if (
                  endV < 1 ||
                  (maxVerseEnd !== undefined && endV > maxVerseEnd)
                ) {
                  validationErrors.push({
                    file: relativePath,
                    date: reading.date,
                    readingOrder: reading.order,
                    section: reading.section,
                    reference: ref,
                    error: `End Verse ${endV} out of bounds for ${bookBounds.name} Chapter ${endCh}. Valid verses: 1 to ${maxVerseEnd}`,
                  });
                  continue;
                }
              }
            }

            // Assert that there are zero validation errors
            expect(validationErrors).toEqual([]);
          });
        });
      }
    }
  }
});
