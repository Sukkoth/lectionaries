/**
 * Telegram Bot API Data Types & Interfaces.
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  text?: string;
}

export interface TelegramChatMember {
  user: TelegramUser;
  status:
    | "creator"
    | "administrator"
    | "member"
    | "restricted"
    | "left"
    | "kicked";
}

export interface TelegramChatMemberUpdated {
  chat: TelegramChat;
  from: TelegramUser;
  date: number;
  old_chat_member: TelegramChatMember;
  new_chat_member: TelegramChatMember;
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance?: string;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: TelegramChatMemberUpdated;
  chat_member?: TelegramChatMemberUpdated;
}

export interface SendMessageOptions {
  parse_mode?: "HTML" | "MarkdownV2" | "Markdown";
  disable_web_page_preview?: boolean;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramResponseParameters {
  migrate_to_chat_id?: number;
  retry_after?: number;
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: TelegramResponseParameters;
}
