import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { getWebhookConfig } from "./config";
import { getDb } from "./firebase";
import { TelegramChatMember, TelegramUpdate, TelegramUser } from "./types";

export interface UserSyncResult {
  upsertCount: number;
  messageSource:
    | "message"
    | "edited_message"
    | "channel_post"
    | "edited_channel_post"
    | "none";
  configuredChatId: string;
  incomingMessageChatId?: string;
  incomingChatMemberChatId?: string;
  messagePresent: boolean;
  messageChatMatched: boolean;
  messageHasFrom: boolean;
  chatMemberPresent: boolean;
  chatMemberChatMatched: boolean;
  skippedReasons: string[];
}

const usersCollection = () => getDb().collection("users");

const resolveMessageForUserSync = (
  update: TelegramUpdate,
): {
  message: TelegramUpdate["message"];
  source:
    | "message"
    | "edited_message"
    | "channel_post"
    | "edited_channel_post"
    | "none";
} => {
  if (update.message) {
    return { message: update.message, source: "message" };
  }

  if (update.edited_message) {
    return { message: update.edited_message, source: "edited_message" };
  }

  if (update.channel_post) {
    return { message: update.channel_post, source: "channel_post" };
  }

  if (update.edited_channel_post) {
    return {
      message: update.edited_channel_post,
      source: "edited_channel_post",
    };
  }

  return { message: undefined, source: "none" };
};

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

const matchesConfiguredChat = (
  incomingChatId: string,
  configuredChatId: string,
): boolean => {
  const incomingIds = toComparableChatIds(incomingChatId);
  const configuredIds = toComparableChatIds(configuredChatId);

  for (const value of incomingIds) {
    if (configuredIds.has(value)) {
      return true;
    }
  }

  return false;
};

const resolveDisplayName = (user?: TelegramUser): string => {
  if (!user) {
    return "unknown";
  }

  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) {
    return fullName;
  }

  if (user.username) {
    return user.username;
  }

  return `user_${user.id}`;
};

const resolveActiveFromMember = (member: TelegramChatMember): boolean => {
  if (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member"
  ) {
    return true;
  }

  if (member.status === "restricted") {
    return member.is_member ?? false;
  }

  return false;
};

const fetchChatMember = async (
  chatId: string,
  userId: string,
): Promise<TelegramChatMember | undefined> => {
  const config = getWebhookConfig();
  if (!config.telegramBotToken) {
    return undefined;
  }

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getChatMember`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: Number(userId) }),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    result?: TelegramChatMember;
    description?: string;
  };

  if (!response.ok || !payload.ok || !payload.result) {
    logger.warn("getChatMember failed for user sync", {
      chat_id: chatId,
      user_id: userId,
      status: response.status,
      description: payload.description,
    });
    return undefined;
  }

  return payload.result;
};

const upsertUserDoc = async (
  chatId: string,
  user: TelegramUser,
  source: "telegram_message" | "telegram_chat_member",
  status: string,
  isActive: boolean,
): Promise<void> => {
  const now = Timestamp.now();
  await usersCollection()
    .doc(String(user.id))
    .set(
      {
        user_id: String(user.id),
        chat_id: chatId,
        display_name: resolveDisplayName(user),
        username: user.username,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        status,
        is_active: isActive,
        source,
        updated_at: now,
        created_at: now,
      },
      { merge: true },
    );
};

export const syncManagedUserFromUpdate = async (
  update: TelegramUpdate,
): Promise<UserSyncResult> => {
  const config = getWebhookConfig();
  const chatId = config.telegramGroupChatId;
  const skippedReasons: string[] = [];

  let upsertCount = 0;
  let messageChatMatched = false;
  let messageHasFrom = false;
  let chatMemberChatMatched = false;

  const messagePayload = resolveMessageForUserSync(update);
  const message = messagePayload.message;
  if (message) {
    messageChatMatched = matchesConfiguredChat(String(message.chat.id), chatId);
    messageHasFrom = Boolean(message.from);
  }

  if (message && message.from && messageChatMatched) {
    const incomingChatId = String(message.chat.id);
    await upsertUserDoc(
      incomingChatId,
      message.from,
      "telegram_message",
      "member",
      true,
    );
    upsertCount += 1;

    const fetchedMember = await fetchChatMember(
      incomingChatId,
      String(message.from.id),
    );
    if (fetchedMember?.user) {
      await upsertUserDoc(
        incomingChatId,
        fetchedMember.user,
        "telegram_message",
        fetchedMember.status,
        resolveActiveFromMember(fetchedMember),
      );
      upsertCount += 1;
    } else {
      skippedReasons.push("message_member_refresh_unavailable");
    }
  } else if (message && !message.from) {
    skippedReasons.push("message_from_missing");
  } else if (message && message.from && !messageChatMatched) {
    skippedReasons.push("message_chat_id_mismatch");
  }

  const chatMember = update.chat_member;
  if (chatMember) {
    chatMemberChatMatched = matchesConfiguredChat(
      String(chatMember.chat.id),
      chatId,
    );
  }

  if (chatMember && chatMemberChatMatched) {
    const incomingChatId = String(chatMember.chat.id);
    await upsertUserDoc(
      incomingChatId,
      chatMember.new_chat_member.user,
      "telegram_chat_member",
      chatMember.new_chat_member.status,
      resolveActiveFromMember(chatMember.new_chat_member),
    );
    upsertCount += 1;
  } else if (chatMember && !chatMemberChatMatched) {
    skippedReasons.push("chat_member_chat_id_mismatch");
  }

  if (!message && !chatMember) {
    skippedReasons.push("unsupported_update_type");
  }

  return {
    upsertCount,
    messageSource: messagePayload.source,
    configuredChatId: chatId,
    incomingMessageChatId: message ? String(message.chat.id) : undefined,
    incomingChatMemberChatId: chatMember
      ? String(chatMember.chat.id)
      : undefined,
    messagePresent: Boolean(message),
    messageChatMatched,
    messageHasFrom,
    chatMemberPresent: Boolean(chatMember),
    chatMemberChatMatched,
    skippedReasons,
  };
};
