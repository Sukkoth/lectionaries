import { describe, expect, test } from "bun:test";

describe("Bible Bounds Dataset - Unit Tests", () => {
  test("check-point/bible-bounds.json contains 66 books and valid chapter/verse counts", async () => {
    const file = Bun.file("check-point/bible-bounds.json");
    expect(await file.exists()).toBe(true);

    const bounds = (await file.json()) as {
      totalBooks: number;
      books: Array<{
        index: number;
        id: string;
        chaptersCount: number;
        chapters: number[];
      }>;
      byIndex: Record<
        string,
        {
          index: number;
          id: string;
          chaptersCount: number;
          chapters: number[];
        }
      >;
    };

    expect(bounds.totalBooks).toBe(66);
    expect(bounds.books.length).toBe(66);
    expect(Object.keys(bounds.byIndex).length).toBe(66);

    // Book 1: Genesis (50 chapters, chapter 1 has 31 verses)
    const gen = bounds.byIndex["1"];
    expect(gen).toBeDefined();
    expect(gen?.index).toBe(1);
    expect(gen?.id).toBe("GEN");
    expect(gen?.chaptersCount).toBe(50);
    expect(gen?.chapters[0]).toBe(31);

    // Book 66: Revelation (22 chapters, chapter 22 has 21 verses)
    const rev = bounds.byIndex["66"];
    expect(rev).toBeDefined();
    expect(rev?.index).toBe(66);
    expect(rev?.id).toBe("REV");
    expect(rev?.chaptersCount).toBe(22);
    expect(rev?.chapters[21]).toBe(21);
  });
});
