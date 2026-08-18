import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DATA_DIR } from "../src/config";

interface VersionMetadata {
  publisher: string;
  license: string;
}

interface TranslationVersion {
  code: string;
  name: string;
  contentVersion: number;
  path: string;
  metadata: VersionMetadata;
}

interface PathReference {
  version: number;
  path: string;
}

interface LanguageEntry {
  code: string;
  name: string;
  holidays: PathReference;
  dayInfo: PathReference;
  versions: TranslationVersion[];
}

interface YearEntry {
  year: number;
  languages: LanguageEntry[];
}

interface Manifest {
  manifestVersion: number;
  published: string;
  years: YearEntry[];
}

interface ReferentialIntegrityError {
  type: "holidays" | "dayInfo" | "readings";
  year: number;
  language: string;
  versionCode?: string;
  referencedPath: string;
  error: string;
}

interface MissingVersionRegistrationError {
  language: string;
  languageCode: string;
  versionCode: string;
  versionName: string;
  error: string;
}

describe("Manifest Validation Suite (data/manifest.json)", () => {
  test("manifest.json exists and is valid JSON", async () => {
    const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));
    expect(await manifestFile.exists()).toBe(true);

    const manifest = (await manifestFile.json()) as Manifest;
    expect(manifest).toBeDefined();
    expect(manifest.manifestVersion).toBeGreaterThan(0);
    expect(typeof manifest.published).toBe("string");
    expect(new Date(manifest.published).toString()).not.toBe("Invalid Date");
    expect(Array.isArray(manifest.years)).toBe(true);
    expect(manifest.years.length).toBeGreaterThan(0);
  });

  test("validate year and language schema rules", async () => {
    const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));
    const manifest = (await manifestFile.json()) as Manifest;

    for (const yearEntry of manifest.years) {
      expect(typeof yearEntry.year).toBe("number");
      expect(yearEntry.year).toBeGreaterThanOrEqual(2000);
      expect(Array.isArray(yearEntry.languages)).toBe(true);
      expect(yearEntry.languages.length).toBeGreaterThan(0);

      const langCodes = new Set<string>();

      for (const lang of yearEntry.languages) {
        expect(typeof lang.code).toBe("string");
        expect(lang.code.trim().length).toBeGreaterThan(0);

        // Ensure language code uniqueness per year
        expect(langCodes.has(lang.code)).toBe(false);
        langCodes.add(lang.code);

        expect(typeof lang.name).toBe("string");
        expect(lang.name.trim().length).toBeGreaterThan(0);

        // Holidays reference schema
        expect(lang.holidays).toBeDefined();
        expect(typeof lang.holidays.version).toBe("number");
        expect(typeof lang.holidays.path).toBe("string");

        // DayInfo reference schema
        expect(lang.dayInfo).toBeDefined();
        expect(typeof lang.dayInfo.version).toBe("number");
        expect(typeof lang.dayInfo.path).toBe("string");

        // Versions schema
        expect(Array.isArray(lang.versions)).toBe(true);
        expect(lang.versions.length).toBeGreaterThan(0);

        const versionCodes = new Set<string>();

        for (const version of lang.versions) {
          expect(typeof version.code).toBe("string");
          expect(version.code.trim().length).toBeGreaterThan(0);

          // Ensure version code uniqueness per language
          expect(versionCodes.has(version.code)).toBe(false);
          versionCodes.add(version.code);

          expect(typeof version.name).toBe("string");
          expect(version.name.trim().length).toBeGreaterThan(0);
          expect(typeof version.contentVersion).toBe("number");
          expect(typeof version.path).toBe("string");

          // Metadata schema
          expect(version.metadata).toBeDefined();
          expect(typeof version.metadata.publisher).toBe("string");
          expect(typeof version.metadata.license).toBe("string");
        }
      }
    }
  });

  test("referential integrity: all manifest referenced files must exist on disk and be valid JSON", async () => {
    const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));
    const manifest = (await manifestFile.json()) as Manifest;
    const integrityErrors: ReferentialIntegrityError[] = [];

    for (const yearEntry of manifest.years) {
      for (const lang of yearEntry.languages) {
        // 1. Validate holidays file existence & JSON parseability
        const holidaysRelativePath = lang.holidays.path;
        const holidaysPath = join(DATA_DIR, holidaysRelativePath);
        const holidaysFile = Bun.file(holidaysPath);
        if (!(await holidaysFile.exists())) {
          integrityErrors.push({
            type: "holidays",
            year: yearEntry.year,
            language: lang.name,
            referencedPath: holidaysRelativePath,
            error: `Referenced holidays file does not exist on disk at path '${holidaysRelativePath}'`,
          });
        } else {
          try {
            await holidaysFile.json();
          } catch (err) {
            integrityErrors.push({
              type: "holidays",
              year: yearEntry.year,
              language: lang.name,
              referencedPath: holidaysRelativePath,
              error: `Referenced holidays file contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }

        // 2. Validate dayInfo file existence & JSON parseability
        const dayInfoRelativePath = lang.dayInfo.path;
        const dayInfoPath = join(DATA_DIR, dayInfoRelativePath);
        const dayInfoFile = Bun.file(dayInfoPath);
        if (!(await dayInfoFile.exists())) {
          integrityErrors.push({
            type: "dayInfo",
            year: yearEntry.year,
            language: lang.name,
            referencedPath: dayInfoRelativePath,
            error: `Referenced dayInfo file does not exist on disk at path '${dayInfoRelativePath}'`,
          });
        } else {
          try {
            await dayInfoFile.json();
          } catch (err) {
            integrityErrors.push({
              type: "dayInfo",
              year: yearEntry.year,
              language: lang.name,
              referencedPath: dayInfoRelativePath,
              error: `Referenced dayInfo file contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        }

        // 3. Validate readings versions files existence & JSON parseability
        for (const version of lang.versions) {
          const readingsRelativePath = version.path;
          const readingsPath = join(DATA_DIR, readingsRelativePath);
          const readingsFile = Bun.file(readingsPath);
          if (!(await readingsFile.exists())) {
            integrityErrors.push({
              type: "readings",
              year: yearEntry.year,
              language: lang.name,
              versionCode: version.code,
              referencedPath: readingsRelativePath,
              error: `Referenced readings file does not exist on disk at path '${readingsRelativePath}'`,
            });
          } else {
            try {
              await readingsFile.json();
            } catch (err) {
              integrityErrors.push({
                type: "readings",
                year: yearEntry.year,
                language: lang.name,
                versionCode: version.code,
                referencedPath: readingsRelativePath,
                error: `Referenced readings file contains invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
              });
            }
          }
        }
      }
    }

    expect(integrityErrors).toEqual([]);
  });

  test("version registration: every manifest translation version MUST exist in check-point/versions.json", async () => {
    const manifestFile = Bun.file(join(DATA_DIR, "manifest.json"));
    const versionsFile = Bun.file("check-point/versions.json");
    expect(await versionsFile.exists()).toBe(true);

    const manifest = (await manifestFile.json()) as Manifest;
    const versionsData = (await versionsFile.json()) as Record<string, unknown>;
    const registrationErrors: MissingVersionRegistrationError[] = [];

    for (const yearEntry of manifest.years) {
      for (const lang of yearEntry.languages) {
        for (const version of lang.versions) {
          const versionEntry =
            versionsData[version.code] ||
            (version.code === "am54" ? versionsData["አማ54"] : undefined);

          if (!versionEntry) {
            registrationErrors.push({
              language: lang.name,
              languageCode: lang.code,
              versionCode: version.code,
              versionName: version.name,
              error: `Translation version code '${version.code}' (${version.name}) is not registered in check-point/versions.json`,
            });
          }
        }
      }
    }

    expect(registrationErrors).toEqual([]);
  });
});
