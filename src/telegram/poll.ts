import { TELEGRAM_BOT_TOKEN } from "../config";
import { deactivateSubscription, upsertSubscription } from "../db/subscriptions";
import { botLogger } from "../utils/logger";
import { handleCallbackQuery } from "./callbacks";
import { deleteWebhook, sendMessage } from "./client";
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
import type { TelegramApiResponse, TelegramUpdate } from "./types";

/**
 * Fetches recent updates directly from Telegram using long polling.
 */
async function getUpdates(
  offset: number
): Promise<TelegramApiResponse<TelegramUpdate[]>> {
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: 30,
        allowed_updates: [
          "message",
          "callback_query",
          "my_chat_member",
          "channel_post",
          "edited_channel_post",
        ],
      }),
    });
    return (await res.json()) as TelegramApiResponse<TelegramUpdate[]>;
  } catch (err) {
    return {
      ok: false,
      description: err instanceof Error ? err.message : String(err),
      error_code: 500,
    };
  }
}

/**
 * Processes a single Telegram update event in local development mode.
 */
async function processUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const newStatus = update.my_chat_member.new_chat_member.status;

      botLogger.info(
        { chatId: chat.id, chatType: chat.type, status: newStatus },
        "Bot membership status updated in chat (poller)"
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
        botLogger.info({ chatId: chat.id }, "Deactivated subscription for chat (poller)");
      }
      return;
    }

    if (update.callback_query) {
      botLogger.info(
        {
          callbackId: update.callback_query.id,
          data: update.callback_query.data,
          from: update.callback_query.from.id,
        },
        "Processing inline button callback (poller)"
      );
      await handleCallbackQuery(update.callback_query);
      return;
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
        "Processing Telegram bot command (poller)"
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
    botLogger.error({ err }, "Error processing update in poll runner");
    if (update.message) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await sendMessage(
        update.message.chat.id,
        `⚠️ <i>Local error:</i> <code>${errMsg}</code>`
      );
    }
  }
}

/**
 * Starts the local long polling loop for testing without a public URL or tunnel.
 */
export async function startTelegramPoller(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    botLogger.warn(
      "TELEGRAM_BOT_TOKEN is not configured. Telegram bot polling will not start"
    );
    return;
  }

  botLogger.info("Starting local Telegram background poller...");
  await deleteWebhook();

  let offset = 0;
  while (true) {
    try {
      const res = await getUpdates(offset);
      if (res.ok && res.result) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          await processUpdate(update);
        }
      } else if (res.description) {
        botLogger.warn({ description: res.description }, "Polling notice from Telegram API");
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      botLogger.error({ err }, "Polling network loop error");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

if (import.meta.main) {
  startTelegramPoller();
}
