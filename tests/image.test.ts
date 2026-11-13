import { describe, expect, test } from "bun:test";
import { renderVerseCard } from "../src/image/renderer";

describe("Scripture Verse Card Renderer Tests", () => {
  test("renderVerseCard generates valid PNG buffer for Ge'ez (Amharic) content", async () => {
    const png = await renderVerseCard({
      headerDate: "ዘሰንበት ኅዳር 3, 2019",
      title: "ትንሣኤ ሙታን",
      description: "በጌታችን ሞትና ትንሣኤ የተገኘው የሕይወት ተስፋ",
      seasonColor: "White",
      versionName: "መጽሐፍ ቅዱስ 1954",
      readings: [
        {
          section: "GOSPEL",
          reference: "የዮሐንስ ወንጌል 11:25",
          textSnippet: "ኢየሱስም አላት፦ ትንሣኤና ሕይወት እኔ ነኝ፤ የሚያምንብኝ ቢሞት እንኳ ሕያው ይሆናል።",
        },
      ],
    });

    expect(png).toBeDefined();
    expect(png.length).toBeGreaterThan(1000);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  test("renderVerseCard generates valid PNG for multiple readings (Sunday layout)", async () => {
    const png = await renderVerseCard({
      headerDate: "Sunday, November 12, 2026",
      title: "First Sunday of Advent",
      description: "Hope and preparation for the coming King",
      seasonColor: "Purple",
      versionName: "English Standard Version",
      readings: [
        {
          section: "OLD_TESTAMENT",
          reference: "Isaiah 9:2-7",
          textSnippet: null,
        },
        {
          section: "EPISTLE",
          reference: "Romans 13:11-14",
          textSnippet: null,
        },
        {
          section: "GOSPEL",
          reference: "Matthew 24:36-44",
          textSnippet: null,
        },
      ],
    });

    expect(png).toBeDefined();
    expect(png.length).toBeGreaterThan(1000);
  });
});
