import { getCachedVerseImage, saveCachedVerseImage } from "../db/image-cache";
import { renderVerseCard } from "../image/renderer";
import { botLogger } from "../utils/logger";
import { sendMessage, sendPhoto } from "./client";
import { buildDailyMessage, getVerseCardData } from "./formatter";

/**
 * Delivers today's scripture reading with an image verse card, falling back to text.
 */
export async function deliverDailyReading(
  destinationChatId: number | string,
  dateStr: string,
  lang: string,
  ver: string
): Promise<{ imageDelivered: boolean }> {
  const result = await buildDailyMessage(dateStr, lang, ver);
  let imageDelivered = false;

  try {
    let cachedFileId = await getCachedVerseImage(dateStr, lang, ver);
    if (!cachedFileId) {
      const cardData = await getVerseCardData(dateStr, lang, ver);
      if (cardData) {
        const pngBuffer = await renderVerseCard(cardData);
        const photoRes = await sendPhoto(destinationChatId, pngBuffer, {
          caption: result.text,
          parse_mode: "HTML",
        });
        if (
          photoRes.ok &&
          photoRes.result?.photo &&
          photoRes.result.photo.length > 0
        ) {
          const fileId =
            photoRes.result.photo[photoRes.result.photo.length - 1]!.file_id;
          saveCachedVerseImage(dateStr, lang, ver, fileId).catch(() => {});
          cachedFileId = fileId;
          imageDelivered = true;
        }
      }
    } else {
      const photoRes = await sendPhoto(destinationChatId, cachedFileId, {
        caption: result.text,
        parse_mode: "HTML",
      });
      if (photoRes.ok) {
        imageDelivered = true;
      }
    }
  } catch (err) {
    botLogger.error({ err }, "Failed to deliver verse photo card");
  }

  if (!imageDelivered) {
    await sendMessage(destinationChatId, result.text);
  }

  return { imageDelivered };
}
