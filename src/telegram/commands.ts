import { ADMIN_CHAT_ID } from "../config";
import {
  getSubscription,
  getSubscriptionStats,
  updateSubscriptionSettings,
  upsertSubscription,
} from "../db/subscriptions";
import {
  formatUtcToLocalTime,
  getFormattedDateInTimezone,
  parseLocalTimeToUtc,
} from "../utils/date";
import { botLogger } from "../utils/logger";
import { getChat, isChatAdmin, sendMessage } from "./client";
import { buildDailyMessage } from "./formatter";
import type { TelegramInlineKeyboardMarkup, TelegramMessage } from "./types";

/**
 * Builds the inline keyboard for the interactive settings menu.
 */
export function getSettingsKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🌐 Change Language & Version", callback_data: "menu:lang" }],
      [
        { text: "⏰ Change Posting Time", callback_data: "menu:time" },
        { text: "📅 Preview Today's Post", callback_data: "action:today" },
      ],
      [
        {
          text: "📲 Download Mobile App",
          url: "https://play.google.com/store/apps/details?id=com.sukkoth.eecmylectionary",
        },
      ],
    ],
  };
}

/**
 * Generates status overview text for a chat in 24-hour format.
 */
function buildStatusText(
  lang: string,
  ver: string,
  postTimeUtc: string,
  tz: string
): string {
  const localTime = formatUtcToLocalTime(postTimeUtc, tz);

  return (
    `📖 <b>Daily Lectionary Bot Configuration</b>\n\n` +
    `• <b>Language:</b> <code>${lang}</code>\n` +
    `• <b>Translation Version:</b> <code>${ver.toUpperCase()}</code>\n` +
    `• <b>Posting Time:</b> <code>${localTime} (24h / UTC+3)</code>\n` +
    `• <b>Timezone:</b> <code>${tz}</code>\n\n` +
    `Use the buttons below to customize settings, or type commands directly.`
  );
}

/**
 * Resolves target chat for command execution. Supports specifying a channel in private DM.
 */
async function resolveCommandChat(
  message: TelegramMessage,
  args: string[]
): Promise<{
  targetChatId: number | string;
  numericChatId: number;
  remainingArgs: string[];
  isAuthorized: boolean;
  isExternalTarget: boolean;
}> {
  const firstArg = args[0]?.trim();
  if (
    message.chat.type === "private" &&
    firstArg &&
    (firstArg.startsWith("@") || /^-?\d+$/.test(firstArg))
  ) {
    let resolvedId: number | string = firstArg;
    let numericId = 0;

    const chatRes = await getChat(firstArg);
    if (chatRes.ok && chatRes.result) {
      resolvedId = chatRes.result.id;
      numericId = chatRes.result.id;
    } else if (/^-?\d+$/.test(firstArg)) {
      numericId = Number.parseInt(firstArg, 10);
    }

    const isAuthorized = message.from
      ? await isChatAdmin(resolvedId, message.from.id)
      : false;

    return {
      targetChatId: resolvedId,
      numericChatId: numericId,
      remainingArgs: args.slice(1),
      isAuthorized,
      isExternalTarget: true,
    };
  }

  const chatId = message.chat.id;
  if (message.chat.type !== "private" && message.from) {
    const isAuthorized = await isChatAdmin(chatId, message.from.id);
    return {
      targetChatId: chatId,
      numericChatId: chatId,
      remainingArgs: args,
      isAuthorized,
      isExternalTarget: false,
    };
  }

  return {
    targetChatId: chatId,
    numericChatId: chatId,
    remainingArgs: args,
    isAuthorized: true,
    isExternalTarget: false,
  };
}

/**
 * Handles /start and /help commands.
 */
export async function handleStartCommand(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const chatType = message.chat.type;
  const chatTitle = message.chat.title || message.from?.first_name || null;

  botLogger.info({ chatId, chatType, chatTitle }, "Handling /start command");

  const sub = await upsertSubscription({
    chatId,
    chatType,
    chatTitle,
  });

  const text = buildStatusText(
    sub.language_code,
    sub.version_code,
    sub.post_time_utc || "05:30",
    sub.timezone
  );

  await sendMessage(chatId, text, {
    reply_markup: getSettingsKeyboard(),
  });
}

/**
 * Handles /settings command.
 */
export async function handleSettingsCommand(
  message: TelegramMessage
): Promise<void> {
  const chatId = message.chat.id;

  botLogger.info({ chatId, chatType: message.chat.type }, "Handling /settings command");

  if (message.chat.type !== "private" && message.from) {
    const isAdmin = await isChatAdmin(chatId, message.from.id);
    if (!isAdmin) {
      botLogger.warn({ chatId, userId: message.from.id }, "Unauthorized settings access attempt");
      await sendMessage(
        chatId,
        "⚠️ Only administrators can configure bot settings for this group."
      );
      return;
    }
  }

  let sub = await getSubscription(chatId);
  if (!sub) {
    sub = await upsertSubscription({
      chatId,
      chatType: message.chat.type,
      chatTitle: message.chat.title || null,
    });
  }

  const text = buildStatusText(
    sub.language_code,
    sub.version_code,
    sub.post_time_utc || "05:30",
    sub.timezone
  );

  await sendMessage(chatId, text, {
    reply_markup: getSettingsKeyboard(),
  });
}

/**
 * Handles /today preview command.
 */
export async function handleTodayCommand(
  message: TelegramMessage,
  args: string[] = []
): Promise<void> {
  const { targetChatId, numericChatId, isAuthorized, isExternalTarget } =
    await resolveCommandChat(message, args);

  botLogger.info(
    { chatId: message.chat.id, targetChatId, isAuthorized, isExternalTarget },
    "Handling /today command"
  );

  if (!isAuthorized) {
    await sendMessage(
      message.chat.id,
      "⚠️ You must be an administrator of the target channel to run this command."
    );
    return;
  }

  const sub = await getSubscription(numericChatId);

  const lang = sub?.language_code || "en";
  const ver = sub?.version_code || "esv";
  const tz = sub?.timezone || "Africa/Addis_Ababa";

  const todayStr = getFormattedDateInTimezone(new Date(), tz);
  const result = await buildDailyMessage(todayStr, lang, ver);

  if (isExternalTarget) {
    await sendMessage(targetChatId, result.text);
    await sendMessage(
      message.chat.id,
      `✅ Today's reading has been posted to <code>${args[0]}</code>.`
    );
  } else {
    await sendMessage(message.chat.id, result.text);
  }
}

/**
 * Handles /app and /download commands providing the Google Play Store link.
 */
export async function handleAppCommand(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const playStoreUrl =
    "https://play.google.com/store/apps/details?id=com.sukkoth.eecmylectionary";

  botLogger.info({ chatId }, "Handling /app command");

  await sendMessage(
    chatId,
    `📱 <b>EECMY Lectionary Mobile App</b>\n\n` +
      `Access daily scripture readings, liturgical calendars, and multi-lingual translations on Android.\n\n` +
      `👉 <a href="${playStoreUrl}">Download on Google Play Store</a>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📲 Download on Google Play", url: playStoreUrl }],
        ],
      },
    }
  );
}

/**
 * Handles /setlanguage command (e.g., /setlanguage am or in DM: /setlanguage @channel am).
 */
export async function handleSetLanguageCommand(
  message: TelegramMessage,
  args: string[]
): Promise<void> {
  const { targetChatId, numericChatId, remainingArgs, isAuthorized } =
    await resolveCommandChat(message, args);

  if (!isAuthorized) {
    await sendMessage(
      message.chat.id,
      "⚠️ Only administrators can change settings."
    );
    return;
  }

  const lang = remainingArgs[0]?.trim();

  if (!lang) {
    await sendMessage(
      message.chat.id,
      "⚠️ Please specify a language code. Example: <code>/setlanguage en</code> or <code>/setlanguage @channel_name am</code> (Options: <code>en</code>, <code>am</code>, <code>om</code>, <code>ktb</code>, <code>hdy</code>, <code>sidamo</code>, <code>ትግርኛ</code>)"
    );
    return;
  }

  let sub = await getSubscription(numericChatId);
  if (!sub) {
    sub = await upsertSubscription({
      chatId: numericChatId,
      chatType: "channel",
      languageCode: lang.toLowerCase(),
    });
  } else {
    await updateSubscriptionSettings(numericChatId, {
      languageCode: lang.toLowerCase(),
    });
  }

  botLogger.info(
    { targetChatId, language: lang.toLowerCase() },
    "Language settings updated via command"
  );

  await sendMessage(
    message.chat.id,
    `✅ Language updated to <code>${lang}</code> for <code>${targetChatId}</code>.`
  );
}

/**
 * Handles /setversion command (e.g., /setversion esv or in DM: /setversion @channel esv).
 */
export async function handleSetVersionCommand(
  message: TelegramMessage,
  args: string[]
): Promise<void> {
  const { targetChatId, numericChatId, remainingArgs, isAuthorized } =
    await resolveCommandChat(message, args);

  if (!isAuthorized) {
    await sendMessage(
      message.chat.id,
      "⚠️ Only administrators can change settings."
    );
    return;
  }

  const ver = remainingArgs[0]?.trim();

  if (!ver) {
    await sendMessage(
      message.chat.id,
      "⚠️ Please specify a version code. Example: <code>/setversion esv</code> or <code>/setversion @channel_name am54</code> (Options: <code>esv</code>, <code>niv</code>, <code>am54</code>, <code>nasv</code>, <code>macqul</code>, <code>kitwoy</code>, <code>guj</code>, <code>xumats</code>, <code>keeskita</code>, <code>qulmax</code>, <code>ትመ15</code>)"
    );
    return;
  }

  let sub = await getSubscription(numericChatId);
  if (!sub) {
    sub = await upsertSubscription({
      chatId: numericChatId,
      chatType: "channel",
      versionCode: ver.toLowerCase(),
    });
  } else {
    await updateSubscriptionSettings(numericChatId, {
      versionCode: ver.toLowerCase(),
    });
  }

  botLogger.info(
    { targetChatId, version: ver.toLowerCase() },
    "Version settings updated via command"
  );

  await sendMessage(
    message.chat.id,
    `✅ Translation version updated to <code>${ver.toUpperCase()}</code> for <code>${targetChatId}</code>.`
  );
}

/**
 * Handles /settime command using 24-hour format (e.g., /settime 08:30 or in DM: /settime @channel 08:30).
 */
export async function handleSetTimeCommand(
  message: TelegramMessage,
  args: string[]
): Promise<void> {
  const { targetChatId, numericChatId, remainingArgs, isAuthorized } =
    await resolveCommandChat(message, args);

  if (!isAuthorized) {
    await sendMessage(
      message.chat.id,
      "⚠️ Only administrators can change settings."
    );
    return;
  }

  const timeStr = remainingArgs[0]?.trim();

  if (!timeStr) {
    await sendMessage(
      message.chat.id,
      "⚠️ Please specify a time in 24-hour HH:mm format on the hour or half-hour. Example: <code>/settime 08:30</code> or <code>/settime @channel_name 06:00</code>."
    );
    return;
  }

  const sub = await getSubscription(numericChatId);
  const tz = sub?.timezone || "Africa/Addis_Ababa";
  const parsed = parseLocalTimeToUtc(timeStr, tz);

  if (!parsed) {
    botLogger.warn(
      { targetChatId, timeStr },
      "Invalid posting time rejected (not on 30-min boundary)"
    );
    await sendMessage(
      message.chat.id,
      "⚠️ Invalid time. Please use a 24-hour time on the hour or half-hour ending in <code>:00</code> or <code>:30</code> (e.g. <code>/settime 06:00</code>, <code>/settime 08:30</code>, <code>/settime 18:00</code>)."
    );
    return;
  }

  if (!sub) {
    await upsertSubscription({
      chatId: numericChatId,
      chatType: "channel",
      postTimeUtc: parsed.utcTime,
      postHourUtc: parsed.utcHour,
    });
  } else {
    await updateSubscriptionSettings(numericChatId, {
      postTimeUtc: parsed.utcTime,
      postHourUtc: parsed.utcHour,
    });
  }

  botLogger.info(
    { targetChatId, localTime: parsed.localTime, utcTime: parsed.utcTime },
    "Posting time updated via command"
  );

  await sendMessage(
    message.chat.id,
    `✅ Posting time updated to <code>${parsed.localTime}</code> (${tz}, 24h format) for <code>${targetChatId}</code>.`
  );
}

/**
 * Superadmin Command: Returns real-time database and system status metrics to authorized admin user.
 */
export async function handleStatsCommand(
  message: TelegramMessage
): Promise<void> {
  const fromUserId = message.from?.id ? String(message.from.id) : "";
  const chatId = String(message.chat.id);

  if (fromUserId !== ADMIN_CHAT_ID && chatId !== ADMIN_CHAT_ID) {
    botLogger.warn(
      { fromUserId, chatId },
      "Unauthorized /stats command attempted"
    );
    return;
  }

  try {
    const stats = await getSubscriptionStats();
    const memoryUsage = process.memoryUsage();
    const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);
    const uptimeMin = Math.round(process.uptime() / 60);

    const typeBreakdown = stats.byChatType
      .map((t) => `  • ${t.chat_type}: <b>${t.count}</b>`)
      .join("\n");

    const langBreakdown = stats.byLanguage
      .map((l) => `  • ${l.language_code}: <b>${l.count}</b>`)
      .join("\n");

    const text =
      `📊 <b>System & Database Health Overview</b>\n\n` +
      `<b>Subscribers:</b>\n` +
      `• Active: <b>${stats.totalActive}</b>\n` +
      `• Inactive / Removed: <b>${stats.totalInactive}</b>\n\n` +
      `<b>By Chat Type:</b>\n${typeBreakdown || "  • None"}\n\n` +
      `<b>By Language:</b>\n${langBreakdown || "  • None"}\n\n` +
      `<b>Server Diagnostics:</b>\n` +
      `• Memory: <b>${heapUsedMb} MB heap / ${rssMb} MB RSS</b>\n` +
      `• Uptime: <b>${uptimeMin} minutes</b>\n` +
      `• Environment: <code>${process.env.NODE_ENV || "development"}</code>`;

    await sendMessage(message.chat.id, text, { parse_mode: "HTML" });
  } catch (err) {
    botLogger.error({ err }, "Error running /stats command");
    await sendMessage(
      message.chat.id,
      `❌ Failed to generate stats: <code>${err instanceof Error ? err.message : String(err)}</code>`
    );
  }
}
