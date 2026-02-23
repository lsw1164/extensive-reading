import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { v7 as uuidv7 } from "uuid";
import { getWebhookConfig } from "./config";
import { getDb } from "./firebase";
import { TelegramMessage, TelegramUpdate } from "./types";

const toComparableChatIds = (chatId: string): Set<string> => {
  const trimmed = chatId.trim();
  const ids = new Set<string>([trimmed]);

  if (trimmed.startsWith("-100")) {
    ids.add(`-${trimmed.slice(4)}`);
  } else if (trimmed.startsWith("-")) {
    ids.add(`-100${trimmed.slice(1)}`);
  }

  return ids;
};

const matchesConfiguredChat = (incomingChatId: string, configuredChatId: string): boolean => {
  const incomingIds = toComparableChatIds(incomingChatId);
  const configuredIds = toComparableChatIds(configuredChatId);

  for (const value of incomingIds) {
    if (configuredIds.has(value)) {
      return true;
    }
  }

  return false;
};

const isGroupPhotoMessage = (message?: TelegramMessage): message is TelegramMessage => {
  if (!message) {
    return false;
  }

  if (message.chat.type !== "group" && message.chat.type !== "supergroup") {
    return false;
  }

  return Array.isArray(message.photo) && message.photo.length > 0;
};

const isCertMessage = (message?: TelegramMessage): message is TelegramMessage => {
  if (!isGroupPhotoMessage(message)) {
    return false;
  }

  const config = getWebhookConfig();
  if (!matchesConfiguredChat(String(message.chat.id), config.telegramGroupChatId)) {
    return false;
  }

  return true;
};

export const saveCertEventIfMatched = async (update: TelegramUpdate): Promise<boolean> => {
  const db = getDb();
  const message = update.message;
  if (!isCertMessage(message)) {
    logger.debug("telegram update ignored", {
      update_id: update.update_id,
      reason: "not_cert_message"
    });
    return false;
  }

  const largestPhoto = message.photo![message.photo!.length - 1];
  const userId = String(message.from?.id ?? "unknown");
  const userName =
    [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") ||
    message.from?.username ||
    "unknown";

  const docId = uuidv7();
  await db.collection("cert_events").doc(docId).set(
    {
      event_id: docId,
      update_id: update.update_id,
      chat_id: String(message.chat.id),
      message_id: message.message_id,
      user_id: userId,
      user_name: userName,
      caption: message.caption ?? "",
      photo_file_id: largestPhoto.file_id,
      telegram_date: Timestamp.fromMillis(message.date * 1000),
      created_at: Timestamp.now()
    },
    { merge: true }
  );

  logger.info("cert event saved", {
    event_id: docId,
    update_id: update.update_id,
    chat_id: String(message.chat.id),
    message_id: message.message_id,
    user_id: userId
  });

  return true;
};
