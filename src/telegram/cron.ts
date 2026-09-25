import type { Context } from "hono";
import { CRON_SECRET } from "../config";
import {
  deactivateSubscription,
  getActiveSubscriptionsByTimeOrHour,
  migrateChatId,
} from "../db/subscriptions";
import {
  getClosestUtcSlotTime,
  getCurrentUtcHour,
  getFormattedDateInTimezone,
} from "../utils/date";
import { cronLogger } from "../utils/logger";
import { notifyAdmin } from "../utils/notifier";
import { sendMessage } from "./client";
import { buildDailyMessage } from "./formatter";

/**
 * Checks if a Telegram API error indicates permanent loss of access to a chat.
 */
function isTerminalTelegramError(
  errorCode?: number,
  description?: string
): boolean {
  if (errorCode === 403) {
    return true;
  }
  if (!description) {
    return false;
  }

  const desc = description.toLowerCase();
  return (
    desc.includes("bot was kicked") ||
    desc.includes("bot was blocked") ||
    desc.includes("chat not found") ||
    desc.includes("user is deactivated") ||
    desc.includes("bot is not a member") ||
    desc.includes("not enough rights") ||
    desc.includes("have no rights to send a message") ||
    desc.includes("need administrator rights")
  );
}

/**
 * Safety execution budget in milliseconds before graceful termination (50s for Vercel/serverless 60s max duration limit).
 */
const MAX_CRON_EXECUTION_MS = 50_000;

/**
 * Dispatches daily morning scripture readings to all active subscribed chats for the current UTC time or hour.
 * Features rate-limiting pacing (~25 req/sec), message caching, 429 retry-after handling, 403 auto-pruning,
 * execution deadline protection, and automatic failure alerts dispatched directly to the admin Telegram.
 */
export async function handleTelegramCron(c: Context): Promise<Response> {
  if (CRON_SECRET) {
    const authHeader = c.req.header("authorization");
    const expectedAuth = `Bearer ${CRON_SECRET}`;
    if (authHeader !== expectedAuth) {
      cronLogger.warn("Unauthorized cron trigger attempt rejected");
      return c.json({ error: "Unauthorized cron execution" }, 401);
    }
  }

  const startTime = performance.now();
  const now = new Date();
  const currentUtcHour = getCurrentUtcHour(now);
  const currentUtcTime = getClosestUtcSlotTime(now);

  cronLogger.info(
    `[Cron] Job received. Querying subscribers for UTC slot ${currentUtcTime} (hour ${currentUtcHour})...`
  );

  let subscriptions: Awaited<ReturnType<typeof getActiveSubscriptionsByTimeOrHour>> = [];
  try {
    subscriptions = await getActiveSubscriptionsByTimeOrHour(
      currentUtcTime,
      currentUtcHour
    );
  } catch (err) {
    cronLogger.error({ err }, "[Cron] Failed to fetch active subscriptions from database");
    notifyAdmin({
      title: "Cron Database Query Failure",
      message: `Failed to fetch active subscriptions for slot ${currentUtcTime} (hour ${currentUtcHour})`,
      level: "CRITICAL",
      error: err,
    }).catch(() => {});
    return c.json({ error: "Database error querying subscriptions" }, 500);
  }

  cronLogger.info(
    `[Cron] Found ${subscriptions.length} active subscriber(s) scheduled for this slot`
  );

  if (subscriptions.length === 0) {
    return c.json({
      ok: true,
      utcTime: currentUtcTime,
      utcHour: currentUtcHour,
      totalEligible: 0,
      success: 0,
      failed: 0,
      deactivated: 0,
      timestamp: new Date().toISOString(),
    });
  }

  let successCount = 0;
  let failedCount = 0;
  let deactivatedCount = 0;
  let timedOut = false;

  const messageCache = new Map<
    string,
    Promise<{ text: string; hasContent: boolean }>
  >();

  const getCachedMessage = (
    dateStr: string,
    lang: string,
    ver: string
  ): Promise<{ text: string; hasContent: boolean }> => {
    const key = `${dateStr}:${lang}:${ver}`;
    if (!messageCache.has(key)) {
      cronLogger.info(
        `[Cron] Preparing daily reading content for date=${dateStr}, lang=${lang}, ver=${ver}`
      );
      messageCache.set(key, buildDailyMessage(dateStr, lang, ver));
    }
    return messageCache.get(key)!;
  };

  const total = subscriptions.length;
  for (let i = 0; i < total; i++) {
    if (performance.now() - startTime > MAX_CRON_EXECUTION_MS) {
      timedOut = true;
      const remaining = total - i;
      cronLogger.warn(
        `[Cron] Execution time limit reached (${MAX_CRON_EXECUTION_MS}ms). Stopping batch to prevent hard timeout. Remaining: ${remaining}`
      );
      notifyAdmin({
        title: "Cron Execution Timeout Warning",
        message: `Cron job hit ${MAX_CRON_EXECUTION_MS / 1000}s limit. Dispatched ${i}/${total} messages before pausing. ${remaining} messages left behind.`,
        level: "WARN",
        context: {
          slot: currentUtcTime,
          processed: i,
          total,
          remaining,
        },
      }).catch(() => {});
      break;
    }

    const sub = subscriptions[i]!;
    const chatLabel = sub.chat_title ? `"${sub.chat_title}" (${sub.chat_id})` : `${sub.chat_id}`;

    try {
      const todayStr = getFormattedDateInTimezone(now, sub.timezone);
      const { text, hasContent } = await getCachedMessage(
        todayStr,
        sub.language_code,
        sub.version_code
      );

      if (!hasContent) {
        cronLogger.warn(
          `[Cron] [${i + 1}/${total}] No readings scheduled for ${todayStr}, skipping ${chatLabel}`
        );
        continue;
      }

      cronLogger.info(
        `[Cron] [${i + 1}/${total}] Sending daily reading to ${chatLabel} (${sub.chat_type}, lang: ${sub.language_code})...`
      );

      let res = await sendMessage(sub.chat_id, text);

      if (!res.ok && res.error_code === 429) {
        const retryAfterSec = res.parameters?.retry_after || 2;
        cronLogger.warn(
          `[Cron] Rate limited (429) on ${chatLabel}. Pausing for ${retryAfterSec}s...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryAfterSec * 1000)
        );
        res = await sendMessage(sub.chat_id, text);
      }

      if (res.ok) {
        successCount++;
        cronLogger.info(`[Cron] [${i + 1}/${total}] Successfully delivered to ${chatLabel}`);
      } else {
        failedCount++;
        cronLogger.warn(
          `[Cron] [${i + 1}/${total}] Delivery failed for ${chatLabel}: ${res.description || "Unknown error"}`
        );

        if (res.parameters?.migrate_to_chat_id) {
          cronLogger.info(
            `[Cron] Migrating chat ${sub.chat_id} -> supergroup ${res.parameters.migrate_to_chat_id}`
          );
          await migrateChatId(sub.chat_id, res.parameters.migrate_to_chat_id);
        } else if (isTerminalTelegramError(res.error_code, res.description)) {
          cronLogger.warn(
            `[Cron] Auto-deactivating unreachable subscriber ${chatLabel} due to error: ${res.description}`
          );
          await deactivateSubscription(sub.chat_id);
          deactivatedCount++;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 40));
    } catch (err) {
      failedCount++;
      cronLogger.error({ err }, `[Cron] Exception while broadcasting to ${chatLabel}`);
    }
  }

  const elapsedMs = Math.round(performance.now() - startTime);
  cronLogger.info(
    `[Cron] Broadcast finished in ${elapsedMs}ms. Succeeded: ${successCount}, Failed: ${failedCount}, Deactivated: ${deactivatedCount}`
  );

  if (failedCount > 0 && failedCount >= successCount) {
    notifyAdmin({
      title: "High Cron Failure Rate Detected",
      message: `High proportion of broadcast failures: ${failedCount} failed out of ${subscriptions.length} total subscribers.`,
      level: "ERROR",
      context: {
        slot: currentUtcTime,
        success: successCount,
        failed: failedCount,
        deactivated: deactivatedCount,
      },
    }).catch(() => {});
  }

  return c.json({
    ok: true,
    utcTime: currentUtcTime,
    utcHour: currentUtcHour,
    totalEligible: subscriptions.length,
    success: successCount,
    failed: failedCount,
    deactivated: deactivatedCount,
    timedOut,
    durationMs: elapsedMs,
    timestamp: new Date().toISOString(),
  });
}
