import {
  getSubscription,
  updateSubscriptionSettings,
} from "../db/subscriptions";
import {
  formatUtcToLocalTime,
  getFormattedDateInTimezone,
  parseLocalTimeToUtc,
} from "../utils/date";
import { botLogger } from "../utils/logger";
import { answerCallbackQuery, isChatAdmin, sendMessage } from "./client";
import { getSettingsKeyboard } from "./commands";
import { buildDailyMessage, loadManifest } from "./formatter";
import type {
  TelegramCallbackQuery,
  TelegramInlineKeyboardButton,
  TelegramInlineKeyboardMarkup,
} from "./types";

/**
 * Builds the inline keyboard for selecting a language from the manifest hierarchy.
 */
async function getLanguageSelectionKeyboard(): Promise<TelegramInlineKeyboardMarkup> {
  const manifest = await loadManifest();
  const languages = manifest?.years[0]?.languages || [];

  const keyboard: TelegramInlineKeyboardButton[][] = [];
  let row: TelegramInlineKeyboardButton[] = [];

  for (const lang of languages) {
    row.push({
      text: lang.name,
      callback_data: `select:lang:${lang.code}`,
    });

    if (row.length === 2) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    keyboard.push(row);
  }

  keyboard.push([{ text: "⬅️ Back", callback_data: "menu:back" }]);

  return { inline_keyboard: keyboard };
}

/**
 * Builds the inline keyboard for selecting a translation version for a specific language.
 */
async function getVersionSelectionKeyboard(
  langCode: string
): Promise<TelegramInlineKeyboardMarkup> {
  const manifest = await loadManifest();
  const languages = manifest?.years[0]?.languages || [];

  const matchedLang = languages.find(
    (l) => l.code.toLowerCase() === langCode.toLowerCase()
  );

  const versions = matchedLang?.versions || [];
  const keyboard: TelegramInlineKeyboardButton[][] = [];

  for (const ver of versions) {
    keyboard.push([
      {
        text: `${ver.name} (${ver.code.toUpperCase()})`,
        callback_data: `set:langver:${langCode}:${ver.code}`,
      },
    ]);
  }

  keyboard.push([{ text: "⬅️ Back to Languages", callback_data: "menu:lang" }]);

  return { inline_keyboard: keyboard };
}

/**
 * Builds the inline keyboard for 24-hour preset posting times.
 */
function getTimeKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "06:00", callback_data: "set:time:06:00" },
        { text: "07:00", callback_data: "set:time:07:00" },
      ],
      [
        { text: "08:30 (Default)", callback_data: "set:time:08:30" },
        { text: "12:00", callback_data: "set:time:12:00" },
      ],
      [
        { text: "18:00", callback_data: "set:time:18:00" },
        { text: "20:00", callback_data: "set:time:20:00" },
      ],
      [{ text: "⬅️ Back", callback_data: "menu:back" }],
    ],
  };
}

/**
 * Routes and handles incoming callback queries from inline buttons.
 */
export async function handleCallbackQuery(
  query: TelegramCallbackQuery
): Promise<void> {
  const data = query.data;
  const message = query.message;
  if (!data || !message) {
    await answerCallbackQuery(query.id);
    return;
  }

  const chatId = message.chat.id;

  if (message.chat.type !== "private") {
    const isAdmin = await isChatAdmin(chatId, query.from.id);
    if (!isAdmin) {
      await answerCallbackQuery(
        query.id,
        "Only administrators can change settings.",
        true
      );
      return;
    }
  }

  if (data === "menu:lang") {
    await answerCallbackQuery(query.id);
    const langKeyboard = await getLanguageSelectionKeyboard();
    await sendMessage(chatId, "🌐 <b>Step 1: Select your language:</b>", {
      reply_markup: langKeyboard,
    });
    return;
  }

  if (data.startsWith("select:lang:")) {
    await answerCallbackQuery(query.id);
    const langCode = data.replace("select:lang:", "");
    const verKeyboard = await getVersionSelectionKeyboard(langCode);
    await sendMessage(
      chatId,
      `📖 <b>Step 2: Select translation version for ${langCode.toUpperCase()}:</b>`,
      { reply_markup: verKeyboard }
    );
    return;
  }

  if (data.startsWith("set:langver:")) {
    const parts = data.split(":");
    const langCode = parts[2] || "en";
    const versionCode = parts[3] || "esv";

    await updateSubscriptionSettings(chatId, {
      languageCode: langCode,
      versionCode: versionCode,
    });

    botLogger.info(
      { chatId, langCode, versionCode },
      "Language & version updated via inline keyboard"
    );

    await answerCallbackQuery(
      query.id,
      `Updated to ${langCode.toUpperCase()} (${versionCode.toUpperCase()})`
    );

    await sendMessage(
      chatId,
      `✅ <b>Language & Translation Updated</b>\n\n` +
        `• <b>Language:</b> <code>${langCode}</code>\n` +
        `• <b>Version:</b> <code>${versionCode.toUpperCase()}</code>`,
      { reply_markup: getSettingsKeyboard() }
    );
    return;
  }

  if (data === "menu:time") {
    await answerCallbackQuery(query.id);
    await sendMessage(
      chatId,
      "⏰ <b>Select posting time (24-hour format):</b>\n\n" +
        "<i>Or send a message:</i> <code>/settime HH:mm</code> <i>(e.g. /settime 08:30 or /settime 14:00)</i>",
      { reply_markup: getTimeKeyboard() }
    );
    return;
  }

  if (data === "menu:back") {
    await answerCallbackQuery(query.id);
    const sub = await getSubscription(chatId);
    const lang = sub?.language_code || "en";
    const ver = sub?.version_code || "esv";
    const tz = sub?.timezone || "Africa/Addis_Ababa";
    const localTime = formatUtcToLocalTime(sub?.post_time_utc || "05:30", tz);

    await sendMessage(
      chatId,
      `⚙️ <b>Settings Overview</b>\n\n` +
        `• <b>Language:</b> <code>${lang}</code>\n` +
        `• <b>Translation:</b> <code>${ver.toUpperCase()}</code>\n` +
        `• <b>Posting Time:</b> <code>${localTime} (24h)</code>`,
      { reply_markup: getSettingsKeyboard() }
    );
    return;
  }

  if (data === "action:today") {
    await answerCallbackQuery(query.id, "Generating today's preview...");
    const sub = await getSubscription(chatId);
    const lang = sub?.language_code || "en";
    const ver = sub?.version_code || "esv";
    const tz = sub?.timezone || "Africa/Addis_Ababa";

    botLogger.info({ chatId, lang, ver }, "Today preview requested via inline button");

    const todayStr = getFormattedDateInTimezone(new Date(), tz);
    const result = await buildDailyMessage(todayStr, lang, ver);
    await sendMessage(chatId, result.text);
    return;
  }

  if (data.startsWith("set:time:")) {
    const timeStr = data.replace("set:time:", "");
    const sub = await getSubscription(chatId);
    const tz = sub?.timezone || "Africa/Addis_Ababa";
    const parsed = parseLocalTimeToUtc(timeStr, tz);

    if (parsed) {
      await updateSubscriptionSettings(chatId, {
        postTimeUtc: parsed.utcTime,
        postHourUtc: parsed.utcHour,
      });

      botLogger.info(
        { chatId, localTime: parsed.localTime, utcTime: parsed.utcTime },
        "Posting time updated via inline button"
      );

      await answerCallbackQuery(
        query.id,
        `Posting time set to ${parsed.localTime}`
      );
      await sendMessage(
        chatId,
        `✅ Posting time set to <code>${parsed.localTime}</code> (24h format).`,
        { reply_markup: getSettingsKeyboard() }
      );
    }
    return;
  }

  await answerCallbackQuery(query.id);
}
