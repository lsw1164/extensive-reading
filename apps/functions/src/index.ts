import { randomUUID } from "node:crypto";
import { logger } from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { saveCertEventIfMatched } from "./cert-events";
import { getWebhookConfig } from "./config";
import { TelegramUpdate } from "./types";
import { syncManagedUserFromUpdate } from "./users";

interface IncomingRequest {
  method?: string;
  header(name: string): string | undefined;
  body: unknown;
}

interface OutgoingResponse {
  status(code: number): OutgoingResponse;
  json(payload: unknown): void;
}

export const handleTelegramWebhook = async (
  req: IncomingRequest,
  res: OutgoingResponse
): Promise<void> => {
  const startedAt = Date.now();
  const requestId = `tgwh_${startedAt}_${randomUUID().slice(0, 8)}`;

  const update = req.body as Partial<TelegramUpdate>;
  const hasMessage = Boolean(update?.message);
  const hasEditedMessage = Boolean(update?.edited_message);
  const hasChannelPost = Boolean(update?.channel_post);
  const hasEditedChannelPost = Boolean(update?.edited_channel_post);
  const hasChatMember = Boolean(update?.chat_member);

  logger.info("telegram webhook request received", {
    request_id: requestId,
    method: req.method ?? "unknown",
      update_id: update?.update_id,
      has_message: hasMessage,
      has_edited_message: hasEditedMessage,
      has_channel_post: hasChannelPost,
      has_edited_channel_post: hasEditedChannelPost,
      has_chat_member: hasChatMember
  });

  if (req.method && req.method !== "POST") {
    logger.warn("telegram webhook rejected", {
      request_id: requestId,
      reason: "method_not_allowed",
      method: req.method
    });
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  const config = getWebhookConfig();

  if (config.webhookSecretToken) {
    const incoming = req.header("x-telegram-bot-api-secret-token");
    if (incoming !== config.webhookSecretToken) {
      logger.warn("telegram webhook rejected", {
        request_id: requestId,
        reason: "invalid_secret_token",
        has_secret_header: Boolean(incoming)
      });
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    logger.debug("telegram webhook secret validated", {
      request_id: requestId,
      has_secret_header: Boolean(incoming)
    });
  }

  try {
    const parsedUpdate = req.body as TelegramUpdate;

    logger.debug("telegram webhook processing started", {
      request_id: requestId,
      update_id: parsedUpdate.update_id
    });

    const userSyncResult = await syncManagedUserFromUpdate(parsedUpdate);
    logger.info("telegram webhook user sync result", {
      request_id: requestId,
      update_id: parsedUpdate.update_id,
      user_upsert_count: userSyncResult.upsertCount,
      user_message_source: userSyncResult.messageSource,
      configured_chat_id: userSyncResult.configuredChatId,
      incoming_message_chat_id: userSyncResult.incomingMessageChatId,
      incoming_chat_member_chat_id: userSyncResult.incomingChatMemberChatId,
      message_present: userSyncResult.messagePresent,
      message_chat_matched: userSyncResult.messageChatMatched,
      message_has_from: userSyncResult.messageHasFrom,
      chat_member_present: userSyncResult.chatMemberPresent,
      chat_member_chat_matched: userSyncResult.chatMemberChatMatched,
      skipped_reasons: userSyncResult.skippedReasons
    });

    if (userSyncResult.messagePresent && !userSyncResult.messageChatMatched) {
      logger.warn("telegram webhook message chat id mismatch", {
        request_id: requestId,
        update_id: parsedUpdate.update_id,
        user_message_source: userSyncResult.messageSource,
        configured_chat_id: userSyncResult.configuredChatId,
        incoming_message_chat_id: userSyncResult.incomingMessageChatId
      });
    }

    if (userSyncResult.chatMemberPresent && !userSyncResult.chatMemberChatMatched) {
      logger.warn("telegram webhook chat member chat id mismatch", {
        request_id: requestId,
        update_id: parsedUpdate.update_id,
        configured_chat_id: userSyncResult.configuredChatId,
        incoming_chat_member_chat_id: userSyncResult.incomingChatMemberChatId
      });
    }

    if (userSyncResult.upsertCount === 0) {
      logger.warn("telegram webhook user sync skipped", {
        request_id: requestId,
        update_id: parsedUpdate.update_id,
        user_message_source: userSyncResult.messageSource,
        configured_chat_id: userSyncResult.configuredChatId,
        incoming_message_chat_id: userSyncResult.incomingMessageChatId,
        incoming_chat_member_chat_id: userSyncResult.incomingChatMemberChatId,
        skipped_reasons: userSyncResult.skippedReasons,
        message_present: userSyncResult.messagePresent,
        message_chat_matched: userSyncResult.messageChatMatched,
        message_has_from: userSyncResult.messageHasFrom,
        chat_member_present: userSyncResult.chatMemberPresent,
        chat_member_chat_matched: userSyncResult.chatMemberChatMatched
      });
    }

    const saved = await saveCertEventIfMatched(parsedUpdate);

    logger.info("telegram webhook handled", {
      request_id: requestId,
      update_id: parsedUpdate.update_id,
      saved,
      user_upsert_count: userSyncResult.upsertCount,
      duration_ms: Date.now() - startedAt
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error("telegram webhook failed", {
      request_id: requestId,
      update_id: update?.update_id,
      duration_ms: Date.now() - startedAt,
      error
    });
    res.status(500).json({ ok: false });
  }
};

export const telegramWebhook = onRequest({ invoker: "public" }, async (req, res) => {
  await handleTelegramWebhook(req, res);
});
