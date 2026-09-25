import type { Context } from "hono";
import { TELEGRAM_WEBHOOK_SECRET } from "../config";
import { deactivateSubscription, upsertSubscription } from "../db/subscriptions";
import { botLogger } from "../utils/logger";
import { handleCallbackQuery } from "./callbacks";
import { sendMessage } from "./client";
import {
  handleAppCommand,
  handleSetLanguageCommand,
  handleSetTimeCommand,
  handleSetVersionCommand,
  handleSettingsCommand,
  handleStartCommand,
  handleStatsCommand,
  handleTodayCommand,
} from "./commands";
import type { TelegramUpdate } from "./types";

/**
 * Handles incoming Telegram Webhook updates.
 */
export async function handleTelegramWebhook(c: Context): Promise<Response> {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const receivedSecret = c.req.header("x-telegram-bot-api-secret-token");
    if (receivedSecret !== TELEGRAM_WEBHOOK_SECRET) {
      botLogger.warn("Unauthorized webhook request rejected");
      return c.json({ error: "Unauthorized webhook request" }, 401);
    }
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json();
  } catch (err) {
    botLogger.warn({ err }, "Invalid JSON payload received at Telegram webhook");
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  try {
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const newStatus = update.my_chat_member.new_chat_member.status;

      botLogger.info(
        { chatId: chat.id, chatType: chat.type, status: newStatus },
        "Bot membership status updated in chat"
      );

      if (newStatus === "member" || newStatus === "administrator") {
        await upsertSubscription({
          chatId: chat.id,
          chatType: chat.type,
          chatTitle: chat.title || chat.first_name || null,
        });

        if (chat.type === "channel") {
          await sendMessage(
            chat.id,
            `📖 <b>Daily Lectionary Connected</b>\n\n` +
              `Daily scripture readings and liturgical info will be shared here every day at 08:30 (UTC+3).`
          );
        } else {
          await sendMessage(
            chat.id,
            `📖 <b>Daily Lectionary Connected</b>\n\n` +
              `Daily scripture readings and liturgical info will be shared here every day at 08:30 (UTC+3).\n\n` +
              `<i>Admins can customize language, translation, and posting time using /settings.</i>`
          );
        }
      } else if (newStatus === "left" || newStatus === "kicked") {
        await deactivateSubscription(chat.id);
        botLogger.info({ chatId: chat.id }, "Deactivated subscription for chat");
      }

      return c.json({ ok: true });
    }

    if (update.callback_query) {
      botLogger.info(
        {
          callbackId: update.callback_query.id,
          data: update.callback_query.data,
          from: update.callback_query.from.id,
        },
        "Processing inline button callback"
      );
      await handleCallbackQuery(update.callback_query);
      return c.json({ ok: true });
    }

    const message = update.message || update.channel_post;
    if (message && message.text) {
      const text = message.text.trim();
      const parts = text.split(/\s+/);
      const commandWithBot = parts[0]?.toLowerCase() || "";
      const command = commandWithBot.split("@")[0];
      const args = parts.slice(1);

      botLogger.info(
        {
          command,
          args,
          chatId: message.chat.id,
          chatType: message.chat.type,
          fromUser: message.from?.id,
        },
        "Processing Telegram bot command"
      );

      if (command === "/start" || command === "/help") {
        await handleStartCommand(message);
      } else if (command === "/settings" || command === "/setup") {
        await handleSettingsCommand(message);
      } else if (command === "/today") {
        await handleTodayCommand(message, args);
      } else if (command === "/app" || command === "/download") {
        await handleAppCommand(message);
      } else if (command === "/setlanguage" || command === "/setlang") {
        await handleSetLanguageCommand(message, args);
      } else if (command === "/setversion" || command === "/setver") {
        await handleSetVersionCommand(message, args);
      } else if (command === "/settime") {
        await handleSetTimeCommand(message, args);
      } else if (command === "/stats" || command === "/health") {
        await handleStatsCommand(message);
      }
    }
  } catch (err) {
    botLogger.error({ err }, "Error processing Telegram update");
    if (update.message) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await sendMessage(
        update.message.chat.id,
        `⚠️ <i>An error occurred while processing your request:</i> <code>${errMsg}</code>`
      );
    }
  }

  return c.json({ ok: true });
}
