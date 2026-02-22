import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveCertEventIfMatched } = vi.hoisted(() => ({
  saveCertEventIfMatched: vi.fn().mockResolvedValue(true)
}));

const { syncManagedUserFromUpdate } = vi.hoisted(() => ({
  syncManagedUserFromUpdate: vi.fn().mockResolvedValue({
    upsertCount: 0,
    messageSource: "none",
    messagePresent: false,
    messageChatMatched: false,
    messageHasFrom: false,
    chatMemberPresent: false,
    chatMemberChatMatched: false,
    skippedReasons: []
  })
}));

vi.mock("../../src/config", () => ({
  getWebhookConfig: () => ({
    telegramGroupChatId: "-1001234567890",
    webhookSecretToken: "secret"
  })
}));

vi.mock("../../src/cert-events", () => ({
  saveCertEventIfMatched
}));

vi.mock("../../src/users", () => ({
  syncManagedUserFromUpdate
}));

import { handleTelegramWebhook } from "../../src/index";

const createResponseMock = () => {
  let statusCode = 0;
  let payload: unknown;

  const response = {
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: (data: unknown) => {
      payload = data;
    }
  };

  return {
    response,
    getStatusCode: () => statusCode,
    getPayload: () => payload
  };
};

describe("telegramWebhook", () => {
  beforeEach(() => {
    saveCertEventIfMatched.mockClear();
    syncManagedUserFromUpdate.mockClear();
  });

  it("returns 401 without valid secret token header", async () => {
    const res = createResponseMock();

    await handleTelegramWebhook(
      {
        header: () => undefined,
        body: { update_id: 1 }
      },
      res.response
    );

    expect(res.getStatusCode()).toBe(401);
    expect(res.getPayload()).toEqual({ ok: false, error: "Unauthorized" });
    expect(saveCertEventIfMatched).not.toHaveBeenCalled();
  });

  it("returns 200 and stores update when secret token matches", async () => {
    const res = createResponseMock();
    const update = { update_id: 2, message: { message_id: 1 } };

    await handleTelegramWebhook(
      {
        header: () => "secret",
        body: update
      },
      res.response
    );

    expect(res.getStatusCode()).toBe(200);
    expect(res.getPayload()).toEqual({ ok: true });
    expect(syncManagedUserFromUpdate).toHaveBeenCalledTimes(1);
    expect(syncManagedUserFromUpdate).toHaveBeenCalledWith(update);
    expect(saveCertEventIfMatched).toHaveBeenCalledTimes(1);
    expect(saveCertEventIfMatched).toHaveBeenCalledWith(update);
  });
});
