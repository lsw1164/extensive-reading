import { getJobConfig, upsertManagedUser } from "@extensive-reading/shared";

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramChatMember {
  user: TelegramUser;
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  is_member?: boolean;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

const getArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
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

const resolveActive = (member: TelegramChatMember): boolean => {
  if (member.status === "member" || member.status === "administrator" || member.status === "creator") {
    return true;
  }

  if (member.status === "restricted") {
    return member.is_member ?? false;
  }

  return false;
};

export const runUserSyncFromTelegram = async (): Promise<void> => {
  const userId = getArg("id");
  if (!userId) {
    throw new Error("Usage: npm run job:user:sync -- --id <telegram_user_id>");
  }

  const config = getJobConfig();
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getChatMember`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: config.telegramGroupChatId, user_id: Number(userId) })
  });

  const payload = (await response.json()) as TelegramApiResponse<TelegramChatMember>;
  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(
      `Telegram getChatMember failed: ${response.status} ${payload.description ?? "unknown error"}`
    );
  }

  const member = payload.result;
  await upsertManagedUser({
    userId: String(member.user.id),
    name: resolveDisplayName(member.user),
    chatId: config.telegramGroupChatId,
    source: "manual",
    username: member.user.username,
    firstName: member.user.first_name,
    lastName: member.user.last_name,
    status: member.status,
    isActive: resolveActive(member)
  });

  console.log(
    `Synced user: ${member.user.id}:${resolveDisplayName(member.user)} status=${member.status} active=${resolveActive(member)}`
  );
};

if (require.main === module) {
  runUserSyncFromTelegram().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
