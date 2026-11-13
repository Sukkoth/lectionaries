import { getDb } from "./client";

export interface VerseImageCacheRecord {
  date: string;
  language_code: string;
  version_code: string;
  telegram_file_id: string;
  created_at: Date;
}

/**
 * Retrieves the cached Telegram file_id for a given date, language, and Bible version.
 */
export async function getCachedVerseImage(
  date: string,
  languageCode: string,
  versionCode: string
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql<{ telegram_file_id: string }[]>`
    SELECT telegram_file_id
    FROM verse_image_cache
    WHERE date = ${date}
      AND language_code = ${languageCode.toLowerCase()}
      AND version_code = ${versionCode.toLowerCase()}
    LIMIT 1
  `;

  return rows[0]?.telegram_file_id || null;
}

/**
 * Stores a generated image's Telegram file_id into the cache table.
 */
export async function saveCachedVerseImage(
  date: string,
  languageCode: string,
  versionCode: string,
  telegramFileId: string
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO verse_image_cache (
      date,
      language_code,
      version_code,
      telegram_file_id,
      created_at
    ) VALUES (
      ${date},
      ${languageCode.toLowerCase()},
      ${versionCode.toLowerCase()},
      ${telegramFileId},
      NOW()
    )
    ON CONFLICT (date, language_code, version_code) DO UPDATE SET
      telegram_file_id = EXCLUDED.telegram_file_id
  `;
}
