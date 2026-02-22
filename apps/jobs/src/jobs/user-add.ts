import { getJobConfig, upsertManagedUser } from "@extensive-reading/shared";

const getArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

export const runUserAdd = async (): Promise<void> => {
  const userId = getArg("id");
  const name = getArg("name");
  if (!userId || !name) {
    throw new Error("Usage: npm run job:user:add -- --id <telegram_user_id> --name <display_name>");
  }

  const config = getJobConfig();
  await upsertManagedUser({
    userId,
    name,
    chatId: config.telegramGroupChatId,
    source: "manual",
    isActive: true,
    status: "member"
  });

  console.log(`Added/updated user: ${userId}:${name}`);
};

if (require.main === module) {
  runUserAdd().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
