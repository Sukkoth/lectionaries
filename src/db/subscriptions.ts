import { getDb } from "./client";

export interface TelegramSubscription {
  chat_id: number;
  chat_type: string;
  chat_title: string | null;
  language_code: string;
  version_code: string;
  post_time_utc: string;
  post_hour_utc: number;
  timezone: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionInput {
  chatId: number;
  chatType: string;
  chatTitle?: string | null;
  languageCode?: string;
  versionCode?: string;
  postTimeUtc?: string;
  postHourUtc?: number;
  timezone?: string;
}

export interface SubscriptionSettings {
  languageCode?: string;
  versionCode?: string;
  postTimeUtc?: string;
  postHourUtc?: number;
  timezone?: string;
  isActive?: boolean;
}

/**
 * Retrieves subscription record for a specific Telegram chat ID.
 */
export async function getSubscription(
  chatId: number
): Promise<TelegramSubscription | null> {
  const sql = getDb();
  const rows = await sql<TelegramSubscription[]>`
    SELECT
      chat_id::bigint as chat_id,
      chat_type,
      chat_title,
      language_code,
      version_code,
      COALESCE(post_time_utc, '05:30') as post_time_utc,
      post_hour_utc,
      timezone,
      is_active,
      created_at,
      updated_at
    FROM telegram_subscriptions
    WHERE chat_id = ${chatId}
    LIMIT 1
  `;

  return rows[0] || null;
}

/**
 * Registers or reactivates a Telegram chat subscription with default 08:30 EAT time.
 */
export async function upsertSubscription(
  input: SubscriptionInput
): Promise<TelegramSubscription> {
  const sql = getDb();
  const languageCode = input.languageCode || "en";
  const versionCode = input.versionCode || "esv";
  const postTimeUtc = input.postTimeUtc || "05:30";
  const postHourUtc = input.postHourUtc ?? 5;
  const timezone = input.timezone || "Africa/Addis_Ababa";
  const chatTitle = input.chatTitle || null;

  const rows = await sql<TelegramSubscription[]>`
    INSERT INTO telegram_subscriptions (
      chat_id,
      chat_type,
      chat_title,
      language_code,
      version_code,
      post_time_utc,
      post_hour_utc,
      timezone,
      is_active,
      updated_at
    ) VALUES (
      ${input.chatId},
      ${input.chatType},
      ${chatTitle},
      ${languageCode},
      ${versionCode},
      ${postTimeUtc},
      ${postHourUtc},
      ${timezone},
      true,
      NOW()
    )
    ON CONFLICT (chat_id) DO UPDATE SET
      chat_type = EXCLUDED.chat_type,
      chat_title = COALESCE(EXCLUDED.chat_title, telegram_subscriptions.chat_title),
      is_active = true,
      updated_at = NOW()
    RETURNING
      chat_id::bigint as chat_id,
      chat_type,
      chat_title,
      language_code,
      version_code,
      COALESCE(post_time_utc, '05:30') as post_time_utc,
      post_hour_utc,
      timezone,
      is_active,
      created_at,
      updated_at
  `;

  const record = rows[0];
  if (!record) {
    throw new Error(`Failed to upsert subscription for chat ${input.chatId}`);
  }

  return record;
}

/**
 * Updates settings for an existing Telegram chat subscription.
 */
export async function updateSubscriptionSettings(
  chatId: number,
  settings: SubscriptionSettings
): Promise<TelegramSubscription | null> {
  const sql = getDb();
  const current = await getSubscription(chatId);
  if (!current) {
    return null;
  }

  const languageCode = settings.languageCode ?? current.language_code;
  const versionCode = settings.versionCode ?? current.version_code;
  const postTimeUtc = settings.postTimeUtc ?? current.post_time_utc;
  const postHourUtc = settings.postHourUtc ?? current.post_hour_utc;
  const timezone = settings.timezone ?? current.timezone;
  const isActive = settings.isActive ?? current.is_active;

  const rows = await sql<TelegramSubscription[]>`
    UPDATE telegram_subscriptions
    SET
      language_code = ${languageCode},
      version_code = ${versionCode},
      post_time_utc = ${postTimeUtc},
      post_hour_utc = ${postHourUtc},
      timezone = ${timezone},
      is_active = ${isActive},
      updated_at = NOW()
    WHERE chat_id = ${chatId}
    RETURNING
      chat_id::bigint as chat_id,
      chat_type,
      chat_title,
      language_code,
      version_code,
      COALESCE(post_time_utc, '05:30') as post_time_utc,
      post_hour_utc,
      timezone,
      is_active,
      created_at,
      updated_at
  `;

  return rows[0] || null;
}

/**
 * Marks a subscription as inactive when the bot is removed from a group/channel.
 */
export async function deactivateSubscription(chatId: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE telegram_subscriptions
    SET
      is_active = false,
      updated_at = NOW()
    WHERE chat_id = ${chatId}
  `;
}

/**
 * Updates a subscription record when a group chat is upgraded to a supergroup.
 */
export async function migrateChatId(
  oldChatId: number,
  newChatId: number
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE telegram_subscriptions
    SET
      chat_id = ${newChatId},
      chat_type = 'supergroup',
      updated_at = NOW()
    WHERE chat_id = ${oldChatId}
  `;
}

/**
 * Retrieves all active subscriptions scheduled for a specific UTC time string (HH:mm) or UTC hour.
 */
export async function getActiveSubscriptionsByTimeOrHour(
  utcTime: string,
  utcHour: number
): Promise<TelegramSubscription[]> {
  const sql = getDb();
  const rows = await sql<TelegramSubscription[]>`
    SELECT
      chat_id::bigint as chat_id,
      chat_type,
      chat_title,
      language_code,
      version_code,
      COALESCE(post_time_utc, '05:30') as post_time_utc,
      post_hour_utc,
      timezone,
      is_active,
      created_at,
      updated_at
    FROM telegram_subscriptions
    WHERE is_active = true
      AND (post_time_utc = ${utcTime} OR post_hour_utc = ${utcHour})
  `;

  return rows;
}

/**
 * Retrieves aggregate subscription statistics for system health and administration.
 */
export async function getSubscriptionStats(): Promise<{
  totalActive: number;
  totalInactive: number;
  byChatType: { chat_type: string; count: number }[];
  byLanguage: { language_code: string; count: number }[];
}> {
  const sql = getDb();
  const [totalActiveRows, totalInactiveRows, typeRows, langRows] =
    await Promise.all([
      sql<{ count: string }[]>`SELECT count(*)::text FROM telegram_subscriptions WHERE is_active = true`,
      sql<{ count: string }[]>`SELECT count(*)::text FROM telegram_subscriptions WHERE is_active = false`,
      sql<{ chat_type: string; count: string }[]>`
        SELECT chat_type, count(*)::text FROM telegram_subscriptions WHERE is_active = true GROUP BY chat_type
      `,
      sql<{ language_code: string; count: string }[]>`
        SELECT language_code, count(*)::text FROM telegram_subscriptions WHERE is_active = true GROUP BY language_code
      `,
    ]);

  return {
    totalActive: Number.parseInt(totalActiveRows[0]?.count || "0", 10),
    totalInactive: Number.parseInt(totalInactiveRows[0]?.count || "0", 10),
    byChatType: typeRows.map((r) => ({
      chat_type: r.chat_type,
      count: Number.parseInt(r.count, 10),
    })),
    byLanguage: langRows.map((r) => ({
      language_code: r.language_code,
      count: Number.parseInt(r.count, 10),
    })),
  };
}


