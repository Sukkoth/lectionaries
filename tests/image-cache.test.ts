import { describe, expect, test } from "bun:test";
import {
  getCachedVerseImage,
  saveCachedVerseImage,
} from "../src/db/image-cache";

describe("Verse Image Cache DB Suite", () => {
  const testDate = "2026-11-12";
  const testLang = "am";
  const testVer = "am54";
  const dummyFileId = "AgACAgQAAxkBAAICa2";

  test("saveCachedVerseImage and getCachedVerseImage persist and retrieve telegram file_id", async () => {
    await saveCachedVerseImage(testDate, testLang, testVer, dummyFileId);
    const retrieved = await getCachedVerseImage(testDate, testLang, testVer);

    expect(retrieved).toBe(dummyFileId);
  });

  test("getCachedVerseImage returns null for non-existent entries", async () => {
    const missing = await getCachedVerseImage(
      "1999-01-01",
      "nonexistent",
      "none"
    );
    expect(missing).toBeNull();
  });
});
