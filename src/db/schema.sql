-- Telegram Bot Subscriptions Table for Supabase PostgreSQL
CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  chat_id BIGINT PRIMARY KEY,
  chat_type TEXT NOT NULL,
  chat_title TEXT,
  language_code TEXT NOT NULL DEFAULT 'en',
  version_code TEXT NOT NULL DEFAULT 'esv',
  post_time_utc TEXT NOT NULL DEFAULT '05:30',
  timezone TEXT NOT NULL DEFAULT 'Africa/Addis_Ababa',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure post_time_utc column exists on existing installations
ALTER TABLE telegram_subscriptions ADD COLUMN IF NOT EXISTS post_time_utc TEXT NOT NULL DEFAULT '05:30';

-- Drop legacy post_hour_utc column if present
ALTER TABLE telegram_subscriptions DROP COLUMN IF EXISTS post_hour_utc;

-- Index for scheduled dispatch by UTC 30-min slot time
CREATE INDEX IF NOT EXISTS idx_active_post_time ON telegram_subscriptions (post_time_utc) WHERE is_active = true;
DROP INDEX IF EXISTS idx_active_post_hour;

