/**
 * Formats a Date object as a YYYY-MM-DD string in a specified timezone.
 */
export function getFormattedDateInTimezone(
  date: Date = new Date(),
  timeZone: string = "Africa/Addis_Ababa"
): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Returns current time in UTC formatted as HH:mm snapped backward (floored) to 30-minute intervals (:00 or :30).
 * Handles cron execution delays by mapping requests to the slot they were triggered for.
 */
export function getClosestUtcSlotTime(date: Date = new Date()): string {
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();

  const slotMinutes = minutes >= 30 ? 30 : 0;

  return `${String(hours).padStart(2, "0")}:${String(slotMinutes).padStart(2, "0")}`;
}

/**
 * Returns current time in UTC formatted as HH:mm.
 */
export function getCurrentUtcTimeFormatted(date: Date = new Date()): string {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Returns the current hour in UTC (0-23).
 */
export function getCurrentUtcHour(date: Date = new Date()): number {
  return date.getUTCHours();
}

/**
 * Parses a 24-hour local time string (HH:mm) into equivalent UTC time string (HH:mm) and UTC hour.
 * Enforces 30-minute boundaries (:00 or :30) to align with standard cron job execution.
 */
export function parseLocalTimeToUtc(
  timeStr: string,
  timeZone: string = "Africa/Addis_Ababa",
  enforce30MinInterval: boolean = true
): { utcTime: string; utcHour: number; localTime: string } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  if (enforce30MinInterval && minutes !== 0 && minutes !== 30) {
    return null;
  }

  const localTimeFormatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  let offsetHours = 3;
  try {
    const now = new Date();
    const testDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
    );

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    });

    const localHourSample = Number.parseInt(formatter.format(testDate), 10);
    offsetHours = localHourSample - 12;
  } catch {
    offsetHours = 3;
  }

  let utcHour = (hours - offsetHours) % 24;
  if (utcHour < 0) {
    utcHour += 24;
  }

  const utcTime = `${String(utcHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return {
    utcTime,
    utcHour,
    localTime: localTimeFormatted,
  };
}

/**
 * Converts a UTC time string (HH:mm) into 24-hour local time string (HH:mm) for display.
 */
export function formatUtcToLocalTime(
  utcTimeStr: string = "05:30",
  timeZone: string = "Africa/Addis_Ababa"
): string {
  const parts = utcTimeStr.split(":");
  const utcHours = Number.parseInt(parts[0] || "5", 10);
  const minutes = parts[1] || "30";

  let offsetHours = 3;
  try {
    const now = new Date();
    const testDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0)
    );

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    });

    const localHourSample = Number.parseInt(formatter.format(testDate), 10);
    offsetHours = localHourSample - 12;
  } catch {
    offsetHours = 3;
  }

  let localHour = (utcHours + offsetHours) % 24;
  if (localHour < 0) {
    localHour += 24;
  }

  return `${String(localHour).padStart(2, "0")}:${minutes}`;
}
