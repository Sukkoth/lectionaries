import { ADMIN_CHAT_ID, TELEGRAM_BOT_TOKEN } from "../config";
import { sendMessage } from "../telegram/client";
import { botLogger } from "./logger";

export interface AlertOptions {
  title: string;
  message: string;
  level?: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  error?: unknown;
  context?: Record<string, unknown>;
}

const alertThrottleMap = new Map<string, number>();
const THROTTLE_DURATION_MS = 5 * 60 * 1000;

/**
 * Dispatches critical system alerts and unexpected errors directly to the superadmin's Telegram chat.
 * Implements throttling to prevent spamming the admin if a recurring error fires repeatedly.
 */
export async function notifyAdmin(options: AlertOptions): Promise<boolean> {
  const { title, message, level = "ERROR", error, context } = options;

  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) {
    return false;
  }

  const throttleKey = `${title}:${message}`;
  const now = Date.now();
  const lastSent = alertThrottleMap.get(throttleKey);

  if (lastSent && now - lastSent < THROTTLE_DURATION_MS) {
    botLogger.info(
      { title },
      "[Alert Notifier] Throttled duplicate alert to admin"
    );
    return false;
  }

  alertThrottleMap.set(now.toString(), now);
  alertThrottleMap.set(throttleKey, now);

  for (const [key, timestamp] of alertThrottleMap.entries()) {
    if (now - timestamp > THROTTLE_DURATION_MS * 2) {
      alertThrottleMap.delete(key);
    }
  }

  const emoji =
    level === "CRITICAL"
      ? "🚨"
      : level === "ERROR"
        ? "❌"
        : level === "WARN"
          ? "⚠️"
          : "ℹ️";

  let errorStack = "";
  if (error) {
    if (error instanceof Error) {
      errorStack = error.stack || error.message;
    } else {
      errorStack = String(error);
    }
    if (errorStack.length > 500) {
      errorStack = `${errorStack.slice(0, 500)}...`;
    }
  }

  let contextStr = "";
  if (context && Object.keys(context).length > 0) {
    try {
      contextStr = `\n<b>Context:</b>\n<pre>${JSON.stringify(context, null, 2)}</pre>`;
    } catch {
      contextStr = "";
    }
  }

  const errorBlock = errorStack
    ? `\n<b>Error Details:</b>\n<pre>${errorStack}</pre>`
    : "";

  const timeStr = new Date().toISOString();
  const alertText =
    `${emoji} <b>[SYSTEM ALERT: ${level}]</b>\n` +
    `<b>Title:</b> ${title}\n` +
    `<b>Message:</b> ${message}\n` +
    `<b>Time:</b> <code>${timeStr}</code>` +
    contextStr +
    errorBlock;

  try {
    const res = await sendMessage(ADMIN_CHAT_ID, alertText, {
      parse_mode: "HTML",
    });

    return res.ok;
  } catch (err) {
    botLogger.error({ err }, "[Alert Notifier] Failed to dispatch admin alert");
    return false;
  }
}
