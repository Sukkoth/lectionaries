import { describe, expect, test } from "bun:test";
import {
  buildDailyMessage,
  formatScriptureText,
} from "../src/telegram/formatter";
import { formatLocalizedHeader } from "../src/utils/localized-date";

describe("Telegram Scripture Message Formatter Suite", () => {
  test("formatLocalizedHeader formats English single vs multiple readings", () => {
    const single = formatLocalizedHeader("2026-09-12", "en", 1);
    expect(single).toBe("Daily Reading for Sat, September 12, 2026");

    const multi = formatLocalizedHeader("2026-09-11", "en", 3);
    expect(multi).toBe("Daily Readings for Fri, September 11, 2026");
  });

  test("formatLocalizedHeader formats Amharic and Afaan Oromoo natively", () => {
    const amHeader = formatLocalizedHeader("2026-09-11", "am", 3);
    expect(amHeader).toBe("የዓርብ፣ መስከረም 1፣ 2019 የዕለት ንባብ");

    const omHeader = formatLocalizedHeader("2026-09-11", "om", 3);
    expect(omHeader).toBe("Dubbisa Guyyaa kan Jimmata, Fulbaana 1, 2019");
  });

  test("formatLocalizedHeader defaults Tigrinya and other languages to English", () => {
    const tigHeader = formatLocalizedHeader("2026-09-11", "ትግርኛ", 3);
    expect(tigHeader).toBe("Daily Readings for Fri, September 11, 2026");

    const sidHeader = formatLocalizedHeader("2026-09-11", "sidamo", 1);
    expect(sidHeader).toBe("Daily Reading for Fri, September 11, 2026");
  });

  test("formatScriptureText converts <v> tags and removes <red> tags without italics", () => {
    const raw =
      "<v>26</v> He said to him, <red>“What is written in the Law?”</red>";
    const formatted = formatScriptureText(raw);

    expect(formatted).toContain("[26]");
    expect(formatted).toContain("“What is written in the Law?”");
    expect(formatted).not.toContain("<v>");
    expect(formatted).not.toContain("<red>");
    expect(formatted).not.toContain("<i>");
  });

  test("buildDailyMessage with >= 3 readings includes header with 'Daily Readings for' and references in blockquote", async () => {
    const result = await buildDailyMessage("2026-09-11", "en", "esv");

    expect(result.hasContent).toBe(true);
    expect(result.text).toContain(
      "Daily Readings for Fri, September 11, 2026"
    );
    expect(result.text).toContain("New Year");
    expect(result.text).toContain("<blockquote>");
    expect(result.text).toContain("Malachi 4:1-6");
    expect(result.text).toContain("Acts 23:12-22");
    expect(result.text).toContain("Luke 1:5-25");
    expect(result.text).toContain("</blockquote>");
    expect(result.text).not.toContain("(ESV)");
  });

  test("buildDailyMessage with < 3 readings includes header with 'Daily Reading for' and blockquote", async () => {
    const result = await buildDailyMessage("2026-09-12", "en", "esv");

    expect(result.hasContent).toBe(true);
    expect(result.text).toContain(
      "Daily Reading for Sat, September 12, 2026"
    );
    expect(result.text).toContain("<blockquote>");
    expect(result.text).toContain("Thus the Lord has done for me");
    expect(result.text).toContain("</blockquote>");
    expect(result.text).toContain("Luke 1:24-25 (ESV)");
  });

  test("buildDailyMessage returns fallback for date with no readings", async () => {
    const result = await buildDailyMessage("1990-01-01", "en", "esv");

    expect(result.hasContent).toBe(false);
    expect(result.text).toContain("No readings scheduled");
  });
});
