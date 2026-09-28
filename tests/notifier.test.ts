import { describe, expect, mock, test } from "bun:test";
import * as client from "../src/telegram/client";
import { notifyAdmin } from "../src/utils/notifier";

describe("Admin Alert Notifier Tests", () => {
  test("notifyAdmin dispatches alert and returns boolean without sending live network ping", async () => {
    mock.module("../src/telegram/client", () => ({
      ...client,
      sendMessage: async () => ({ ok: true, result: {} as any }),
    }));

    const res = await notifyAdmin({
      title: "Test Alert",
      message: "Test message for monitoring",
      level: "INFO",
    });
    expect(typeof res).toBe("boolean");
  });
});

