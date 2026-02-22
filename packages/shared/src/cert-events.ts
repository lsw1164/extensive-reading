import { Timestamp } from "firebase-admin/firestore";
import { v7 as uuidv7 } from "uuid";
import { getWebhookConfig } from "./config";
import { getDb } from "./firebase";
import { getCertDayKey } from "./time";
import { TelegramMessage, TelegramUpdate } from "./types";

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
  if (String(message.chat.id) !== config.telegramGroupChatId) {
    return false;
  }

  if (!config.certCaptionRegex) {
    return true;
  }

  return config.certCaptionRegex.test(message.caption ?? "");
};

export const saveCertEventIfMatched = async (update: TelegramUpdate): Promise<boolean> => {
  const db = getDb();
  const message = update.message;
  if (!isCertMessage(message)) {
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

  return true;
};

interface WeeklyCount {
  userId: string;
  userName: string;
  count: number;
}

export const countByUserBetween = async (
  start: Date,
  end: Date
): Promise<Map<string, WeeklyCount>> => {
  const db = getDb();
  const snap = await db
    .collection("cert_events")
    .where("telegram_date", ">=", Timestamp.fromDate(start))
    .where("telegram_date", "<", Timestamp.fromDate(end))
    .get();

  const counts = new Map<string, WeeklyCount>();
  const countedDayKeysByUser = new Map<string, Set<string>>();
  const latestTelegramDateByUser = new Map<string, Date>();
  const latestUserNameByUser = new Map<string, string>();

  snap.forEach((doc) => {
    const data = doc.data();
    const userId = String(data.user_id ?? "unknown");
    const userName = String(data.user_name ?? "unknown");
    const telegramDate = data.telegram_date?.toDate?.();
    if (!(telegramDate instanceof Date)) {
      return;
    }

    const latestTelegramDate = latestTelegramDateByUser.get(userId);
    if (!latestTelegramDate || telegramDate > latestTelegramDate) {
      latestTelegramDateByUser.set(userId, telegramDate);
      latestUserNameByUser.set(userId, userName);
    }

    const certDayKey = getCertDayKey(telegramDate);
    const dayKeys = countedDayKeysByUser.get(userId) ?? new Set<string>();
    if (dayKeys.has(certDayKey)) {
      return;
    }
    dayKeys.add(certDayKey);
    countedDayKeysByUser.set(userId, dayKeys);

    const existing = counts.get(userId);
    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(userId, { userId, userName, count: 1 });
  });

  counts.forEach((value, userId) => {
    const latestUserName = latestUserNameByUser.get(userId);
    if (!latestUserName) {
      return;
    }

    value.userName = latestUserName;
  });

  return counts;
};
