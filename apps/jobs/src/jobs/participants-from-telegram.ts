import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@extensive-reading/shared";

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramChatMember {
  user: TelegramUser;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
  };
}

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const resolveDisplayName = (user: TelegramUser): string => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (user.username) {
    return user.username;
  }

  return `user_${user.id}`;
};

export const runParticipantsFromTelegram = async (): Promise<void> => {
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const configuredChatId = getRequiredEnv("TELEGRAM_GROUP_CHAT_ID");
  const url = `https://api.telegram.org/bot${botToken}/getChatAdministrators`;

  const requestAdmins = async (chatId: string | number): Promise<TelegramChatMember[]> => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId })
    });

    const payload = (await response.json()) as TelegramApiResponse<TelegramChatMember[]>;
    if (response.ok && payload.ok && payload.result) {
      return payload.result;
    }

    const migratedChatId = payload.parameters?.migrate_to_chat_id;
    if (migratedChatId !== undefined && String(chatId) !== String(migratedChatId)) {
      return requestAdmins(migratedChatId);
    }

    const description = payload.description ?? "unknown error";
    throw new Error(`Telegram getChatAdministrators failed: ${response.status} ${description}`);
  };

  const admins = await requestAdmins(configuredChatId);

  const unique = new Map<string, string>();
  admins.forEach((member) => {
    const id = String(member.user.id);
    unique.set(id, resolveDisplayName(member.user));
  });

  const db = getDb();
  const snap = await db
    .collection("cert_events")
    .orderBy("telegram_date", "desc")
    .limit(5000)
    .get();

  const seenFromCertEvents = new Set<string>();
  snap.forEach((doc) => {
    const data = doc.data();
    const userId = String(data.user_id ?? "").trim();
    if (!userId || userId === "unknown" || seenFromCertEvents.has(userId)) {
      return;
    }

    const telegramDate = data.telegram_date;
    if (!(telegramDate instanceof Timestamp)) {
      return;
    }

    seenFromCertEvents.add(userId);
    if (unique.has(userId)) {
      return;
    }

    const userName = String(data.user_name ?? "").trim();
    unique.set(userId, userName || `user_${userId}`);
  });

  const participants = Array.from(unique.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, name]) => `${id}:${name}`)
    .join(",");

  console.log("# Telegram 관리자 + cert_events 일반 멤버 기준 사용자 목록 초안");
  console.log(participants);
};

if (require.main === module) {
  runParticipantsFromTelegram().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
