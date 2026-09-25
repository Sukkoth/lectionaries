import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const PORT = Number.parseInt(process.env.PORT || "3000", 10);

/**
 * Resolves directory path for lectionary dataset files.
 */
const resolveDataDir = (): string => {
  if (process.env.DATA_DIR) {
    return resolve(process.env.DATA_DIR);
  }

  const metaDirData = resolve(import.meta.dir || "", "data");
  if (existsSync(metaDirData)) {
    return metaDirData;
  }

  const rootDistData = resolve(process.cwd(), "dist/data");
  if (existsSync(rootDistData)) {
    return rootDistData;
  }

  return resolve(process.cwd(), "data");
};

export const DATA_DIR = resolveDataDir();

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export const CACHE_CONTROL =
  process.env.CACHE_CONTROL || "public, max-age=3600";

/**
 * PostgreSQL Database connection URI for Supabase.
 */
export const DATABASE_URL = process.env.DATABASE_URL || "";

/**
 * Telegram Bot API configuration parameters.
 */
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
export const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

/**
 * Secret token used to authenticate Vercel Cron trigger requests.
 */
export const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Scheduling and timezone defaults.
 */
export const DEFAULT_TIMEZONE =
  process.env.DEFAULT_TIMEZONE || "Africa/Addis_Ababa";
export const DEFAULT_POST_HOUR_UTC = Number.parseInt(
  process.env.DEFAULT_POST_HOUR_UTC || "3",
  10
);

/**
 * Superadmin Telegram user ID for critical alerts, failures, and system monitoring.
 */
export const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
