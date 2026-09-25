import { describe, expect, test } from "bun:test";
import {
  formatUtcToLocalTime,
  getClosestUtcSlotTime,
  getCurrentUtcHour,
  getFormattedDateInTimezone,
  parseLocalTimeToUtc,
} from "../src/utils/date";

describe("Date and Timezone Utility Tests", () => {
  test("getFormattedDateInTimezone formats correctly in Africa/Addis_Ababa", () => {
    const testDate = new Date("2026-09-25T00:00:00.000Z");
    const formatted = getFormattedDateInTimezone(
      testDate,
      "Africa/Addis_Ababa"
    );
    expect(formatted).toBe("2026-09-25");
  });

  test("getCurrentUtcHour returns expected UTC hour", () => {
    const testDate = new Date("2026-09-25T03:45:00.000Z");
    expect(getCurrentUtcHour(testDate)).toBe(3);
  });

  test("parseLocalTimeToUtc converts 08:30 EAT (UTC+3) to 05:30 UTC", () => {
    const result = parseLocalTimeToUtc("08:30", "Africa/Addis_Ababa");
    expect(result).not.toBeNull();
    expect(result?.utcTime).toBe("05:30");
    expect(result?.utcHour).toBe(5);
    expect(result?.localTime).toBe("08:30");
  });

  test("parseLocalTimeToUtc converts 12:00 EAT to 09:00 UTC", () => {
    const result = parseLocalTimeToUtc("12:00", "Africa/Addis_Ababa");
    expect(result?.utcTime).toBe("09:00");
  });

  test("parseLocalTimeToUtc returns null for non-30-minute increments", () => {
    expect(parseLocalTimeToUtc("08:15", "Africa/Addis_Ababa")).toBeNull();
    expect(parseLocalTimeToUtc("08:45", "Africa/Addis_Ababa")).toBeNull();
  });

  test("getClosestUtcSlotTime snaps execution time backward to 30-minute slot", () => {
    const d1 = new Date("2026-09-25T05:30:45.000Z");
    expect(getClosestUtcSlotTime(d1)).toBe("05:30");

    const d2 = new Date("2026-09-25T05:31:12.000Z");
    expect(getClosestUtcSlotTime(d2)).toBe("05:30");

    const d3 = new Date("2026-09-25T05:46:12.000Z");
    expect(getClosestUtcSlotTime(d3)).toBe("05:30");

    const d4 = new Date("2026-09-25T06:01:05.000Z");
    expect(getClosestUtcSlotTime(d4)).toBe("06:00");

    const d5 = new Date("2026-09-25T06:16:00.000Z");
    expect(getClosestUtcSlotTime(d5)).toBe("06:00");
  });

  test("formatUtcToLocalTime converts 05:30 UTC to 08:30 in Africa/Addis_Ababa", () => {
    const local = formatUtcToLocalTime("05:30", "Africa/Addis_Ababa");
    expect(local).toBe("08:30");
  });
});
