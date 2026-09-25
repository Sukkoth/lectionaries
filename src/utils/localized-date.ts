import { toEC } from "kenat";

export interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
}

/**
 * Converts a Gregorian YYYY-MM-DD string to Ethiopian Calendar date components using kenat.
 */
export function gregorianToEthiopian(dateStr: string): CalendarDateParts {
  const parts = dateStr.split("-");
  const gYear = Number.parseInt(parts[0] || "2026", 10);
  const gMonth = Number.parseInt(parts[1] || "1", 10);
  const gDay = Number.parseInt(parts[2] || "1", 10);

  const gDate = new Date(Date.UTC(gYear, gMonth - 1, gDay, 12, 0, 0));
  const dayOfWeek = gDate.getUTCDay();

  const ec = toEC(gYear, gMonth, gDay);

  return {
    year: ec.year,
    month: ec.month,
    day: ec.day,
    dayOfWeek,
  };
}

/**
 * Month names for Ethiopian calendar (Amharic and Afaan Oromoo).
 */
export const ETHIOPIAN_MONTH_NAMES: Record<string, string[]> = {
  am: [
    "መስከረም",
    "ጥቅምት",
    "ኅዳር",
    "ታኅሣሥ",
    "ጥር",
    "የካቲት",
    "መጋቢት",
    "ሚያዝያ",
    "ግንቦት",
    "ሰኔ",
    "ሐምሌ",
    "ነሐሴ",
    "ጳጉሜ",
  ],
  om: [
    "Fulbaana",
    "Onkololeessa",
    "Sadaasa",
    "Muddee",
    "Amajjii",
    "Guraandhala",
    "Bitooteessa",
    "Ebla",
    "Caamsaa",
    "Waxabajjii",
    "Adoolessa",
    "Hagayya",
    "Qaammee",
  ],
};

/**
 * Day-of-week names for Amharic and Afaan Oromoo (Index 0 = Sunday).
 */
export const LOCALIZED_DAY_NAMES: Record<string, string[]> = {
  am: ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"],
  om: ["Dilbata", "Wiixata", "Qibxata", "Roobii", "Kamiisa", "Jimmata", "Sanbata"],
};

/**
 * Formats a localized header string based on language, date, and reading count.
 * Amharic and Afaan Oromoo use their native Ethiopian calendar names; all other languages default to English.
 */
export function formatLocalizedHeader(
  dateStr: string,
  languageCode: string = "en",
  readingCount: number = 1
): string {
  const lang = languageCode.toLowerCase();

  if (lang === "om") {
    const ethParts = gregorianToEthiopian(dateStr);
    const dayNames = LOCALIZED_DAY_NAMES.om!;
    const monthNames = ETHIOPIAN_MONTH_NAMES.om!;
    const dayName = dayNames[ethParts.dayOfWeek] || "";
    const monthName = monthNames[ethParts.month - 1] || "";
    return `Dubbisa Guyyaa kan ${dayName}, ${monthName} ${ethParts.day}, ${ethParts.year}`;
  }

  if (lang === "am") {
    const ethParts = gregorianToEthiopian(dateStr);
    const dayNames = LOCALIZED_DAY_NAMES.am!;
    const monthNames = ETHIOPIAN_MONTH_NAMES.am!;
    const dayName = dayNames[ethParts.dayOfWeek] || "";
    const monthName = monthNames[ethParts.month - 1] || "";
    return `የ${dayName}፣ ${monthName} ${ethParts.day}፣ ${ethParts.year} የዕለት ንባብ`;
  }

  const parts = dateStr.split("-");
  const year = Number.parseInt(parts[0] || "2026", 10);
  const month = Number.parseInt(parts[1] || "1", 10) - 1;
  const day = Number.parseInt(parts[2] || "1", 10);
  const d = new Date(Date.UTC(year, month, day, 12, 0, 0));

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(d);
  const monthName = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
  }).format(d);

  const prefix = readingCount > 1 ? "Daily Readings for" : "Daily Reading for";
  return `${prefix} ${weekday}, ${monthName} ${day}, ${year}`;
}
