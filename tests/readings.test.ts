import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DATA_DIR } from "../src/config";

interface ReadingItem {
  date?: string;
  order?: number;
  version?: string;
  section?: string;
  reference?: string;
  text?: string;
  error?: unknown;
}

interface ReadingsFile {
  version?: number;
  readings?: ReadingItem[];
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

interface FieldValidationError {
  file: string;
  date?: string;
  readingOrder?: number;
  reference?: string;
  error: string;
}

const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));
const manifest = (await manifestFile.json()) as Manifest;

describe("Language Readings Validation Suite", () => {
  for (const yearEntry of manifest.years) {
    for (const lang of yearEntry.languages) {
      for (const ver of lang.versions) {
        describe(`Language: ${lang.name} [${lang.code}] | Version: ${ver.name} [${ver.code}]`, () => {
          const relativePath = ver.path;
          const filePath = join(DATA_DIR, relativePath);
          const file = Bun.file(filePath);

          test("readings file exists and contains non-empty readings array", async () => {
            const fileExists = await file.exists();
            if (!fileExists) {
              expect([
                {
                  file: relativePath,
                  error: `Readings file does not exist on disk at path '${relativePath}'`,
                },
              ]).toEqual([]);
              return;
            }

            const data = (await file.json()) as ReadingsFile;
            if (!Array.isArray(data.readings) || data.readings.length === 0) {
              expect([
                {
                  file: relativePath,
                  error: `Readings file contains empty or missing 'readings' array`,
                },
              ]).toEqual([]);
              return;
            }

            expect(Array.isArray(data.readings)).toBe(true);
            expect(data.readings.length).toBeGreaterThan(0);
          });

          test("reading items version matches manifest version code", async () => {
            const data = (await file.json()) as ReadingsFile;
            const errors: FieldValidationError[] = [];

            if (data.readings) {
              for (const item of data.readings) {
                if (item.version !== ver.code) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Reading item version '${item.version}' does not match manifest version code '${ver.code}'`,
                  });
                }
              }
            }

            expect(errors).toEqual([]);
          });

          test("reading items contain all required fields and NO error field", async () => {
            const data = (await file.json()) as ReadingsFile;
            const errors: FieldValidationError[] = [];

            if (data.readings) {
              for (const item of data.readings) {
                // 1. date check
                if (
                  typeof item.date !== "string" ||
                  !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
                ) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Invalid or missing 'date' field (expected YYYY-MM-DD string, got '${item.date}')`,
                  });
                }

                // 2. order check
                if (typeof item.order !== "number" || item.order < 1) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Invalid or missing 'order' field (expected positive integer, got '${item.order}')`,
                  });
                }

                // 3. version check
                if (typeof item.version !== "string") {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Missing 'version' field`,
                  });
                }

                // 4. section check
                if (
                  typeof item.section !== "string" ||
                  item.section.trim().length === 0
                ) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Invalid or missing 'section' field`,
                  });
                }

                // 5. reference check
                if (
                  typeof item.reference !== "string" ||
                  item.reference.trim().length === 0
                ) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Invalid or missing 'reference' field`,
                  });
                }

                // 6. text check
                if (
                  typeof item.text !== "string" ||
                  item.text.trim().length === 0
                ) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Invalid or missing 'text' field (empty reading text content)`,
                  });
                }

                // 7. Scraper error field check
                if (item.error !== undefined || "error" in item) {
                  errors.push({
                    file: relativePath,
                    date: item.date,
                    readingOrder: item.order,
                    reference: item.reference,
                    error: `Scraper error detected in reading item! Found 'error' field with value: '${String(item.error)}'`,
                  });
                }
              }
            }

            expect(errors).toEqual([]);
          });
        });
      }
    }
  }
});
