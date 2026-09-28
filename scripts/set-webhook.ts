import { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET } from "../src/config";
import { setWebhook } from "../src/telegram/client";

/**
 * Automatically registers the Telegram webhook callback using environment variables.
 * Discovers the domain in this order:
 * 1. CLI argument (e.g. bun run bot:set-webhook https://custom.domain)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (system env provided automatically by Vercel for canonical domain)
 * 3. VERCEL_URL (system env provided by Vercel on every deployment)
 * 4. WEBHOOK_URL or PUBLIC_URL or APP_URL (custom user env vars)
 */
async function main() {
  const customArg = process.argv[2];
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production";

  if (!customArg && !isProduction) {
    console.log(
      "ℹ️ [Telegram Webhook Setup] Skipped: Not in production environment (NODE_ENV !== production)."
    );
    return;
  }

  let domain =
    customArg ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.WEBHOOK_URL

  if (!domain) {
    console.warn(
      "⚠️ [Telegram Webhook Setup] No domain provided or found in environment variables (VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL, WEBHOOK_URL). Skipping webhook registration."
    );
    return;
  }

  if (!TELEGRAM_BOT_TOKEN) {
    console.warn(
      "⚠️ [Telegram Webhook Setup] TELEGRAM_BOT_TOKEN is not configured. Skipping webhook registration."
    );
    return;
  }

  if (!domain.startsWith("http://") && !domain.startsWith("https://")) {
    domain = `https://${domain}`;
  }

  const cleanBaseUrl = domain.trim().replace(/\/+$/, "");
  const webhookUrl = `${cleanBaseUrl}/api/telegram/webhook`;

  console.log(`📡 [Telegram Webhook Setup] Registering webhook...`);
  console.log(`• Webhook URL: ${webhookUrl}`);
  console.log(
    `• Secret Token: ${TELEGRAM_WEBHOOK_SECRET ? "Configured ✅" : "None"}`
  );

  const res = await setWebhook(
    webhookUrl,
    TELEGRAM_WEBHOOK_SECRET || undefined
  );

  if (res.ok) {
    console.log("✅ [Telegram Webhook Setup] Webhook successfully registered with Telegram!");
  } else {
    console.error(
      `❌ [Telegram Webhook Setup] Failed to register webhook: ${res.description} (Error code: ${res.error_code})`
    );
  }
}

main().catch((err) => {
  console.error("❌ [Telegram Webhook Setup] Unexpected error:", err);
});
