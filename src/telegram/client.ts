import { TELEGRAM_BOT_TOKEN } from "../config";
import { botLogger } from "../utils/logger";
import type {
  SendMessageOptions,
  TelegramApiResponse,
  TelegramChat,
  TelegramChatMember,
  TelegramMessage,
} from "./types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Sends an HTTP request to the Telegram Bot API.
 */
async function callTelegramApi<T>(
  method: string,
  payload?: Record<string, unknown>
): Promise<TelegramApiResponse<T>> {
  if (!TELEGRAM_BOT_TOKEN) {
    botLogger.warn(`[Telegram API] Attempted to call ${method} without TELEGRAM_BOT_TOKEN`);
    return {
      ok: false,
      description: "TELEGRAM_BOT_TOKEN is not configured",
      error_code: 401,
    };
  }

  const endpoint = `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/${method}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = (await res.json()) as TelegramApiResponse<T>;
    if (!data.ok) {
      botLogger.warn(
        { method, errorCode: data.error_code, description: data.description },
        `[Telegram API] ${method} returned error: ${data.description}`
      );
    }
    return data;
  } catch (err) {
    botLogger.error({ err, method }, `[Telegram API] Network failure calling ${method}`);
    return {
      ok: false,
      description: err instanceof Error ? err.message : String(err),
      error_code: 500,
    };
  }
}

/**
 * Sends a text message to a Telegram chat or channel.
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: SendMessageOptions
): Promise<TelegramApiResponse<TelegramMessage>> {
  return callTelegramApi<TelegramMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode || "HTML",
    disable_web_page_preview: options?.disable_web_page_preview ?? true,
    reply_markup: options?.reply_markup,
  });
}

/**
 * Retrieves chat information (supports resolving @channel_username to chat_id).
 */
export async function getChat(
  chatId: number | string
): Promise<TelegramApiResponse<TelegramChat>> {
  return callTelegramApi<TelegramChat>("getChat", {
    chat_id: chatId,
  });
}

/**
 * Retrieves membership info of a specific user in a chat.
 */
export async function getChatMember(
  chatId: number | string,
  userId: number
): Promise<TelegramApiResponse<TelegramChatMember>> {
  return callTelegramApi<TelegramChatMember>("getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
}

/**
 * Verifies if a user has administrator or creator privileges in a chat.
 */
export async function isChatAdmin(
  chatId: number | string,
  userId: number
): Promise<boolean> {
  const res = await getChatMember(chatId, userId);
  if (!res.ok || !res.result) {
    return false;
  }

  const status = res.result.status;
  return status === "creator" || status === "administrator";
}

/**
 * Sends a response to an incoming callback query from an inline keyboard.
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

/**
 * Registers a public webhook URL with Telegram with all required update types.
 */
export async function setWebhook(
  url: string,
  secretToken?: string
): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: [
      "message",
      "callback_query",
      "my_chat_member",
      "channel_post",
      "edited_channel_post",
    ],
  });
}

/**
 * Removes the currently registered webhook from Telegram.
 */
export async function deleteWebhook(): Promise<TelegramApiResponse<boolean>> {
  return callTelegramApi<boolean>("deleteWebhook");
}
