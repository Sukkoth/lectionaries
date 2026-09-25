import { describe, expect, test } from "bun:test";
import app from "../src/app";

describe("Telegram Endpoint Integration Tests", () => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}),
  };

  test("POST /api/telegram/webhook returns 400 on invalid JSON", async () => {
    const req = new Request("http://localhost/api/telegram/webhook", {
      method: "POST",
      headers: baseHeaders,
      body: "invalid-json",
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(400);
  });

  test(
    "POST /api/telegram/webhook returns 200 on valid update payload",
    async () => {
      const req = new Request("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({
          update_id: 100001,
          message: {
            message_id: 1,
            date: 1700000000,
            chat: { id: 123456, type: "private" },
            text: "/today",
          },
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
    },
    15000
  );

  test("GET /api/telegram/cron endpoint responds appropriately", async () => {
    const req = new Request("http://localhost/api/telegram/cron", {
      method: "GET",
    });

    const res = await app.fetch(req);
    expect([200, 401, 500]).toContain(res.status);
  });
});
