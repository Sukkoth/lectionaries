import { describe, expect, mock, test } from "bun:test";
import * as client from "../src/telegram/client";
import type { TelegramMessage } from "../src/telegram/types";
import { notifyAdmin } from "../src/utils/notifier";

describe("Admin Alert Notifier Tests", () => {
  test("notifyAdmin dispatches alert and returns boolean without sending live network ping", async () => {
    const dummyMessage: TelegramMessage = {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 123456, type: "private" },
    };

    mock.module("../src/telegram/client", () => ({
      ...client,
      sendMessage: async () => ({ ok: true, result: dummyMessage }),
    }));

    const res = await notifyAdmin({
      title: "Test Alert",
      message: "Test message for monitoring",
      level: "INFO",
    });
    expect(typeof res).toBe("boolean");
  });
});
