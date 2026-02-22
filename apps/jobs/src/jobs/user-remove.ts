import { setManagedUserActive } from "@extensive-reading/shared";

const getArg = (name: string): string | undefined => {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
};

export const runUserRemove = async (): Promise<void> => {
  const userId = getArg("id");
  if (!userId) {
    throw new Error("Usage: npm run job:user:remove -- --id <telegram_user_id>");
  }

  await setManagedUserActive(userId, false, "manual_remove");
  console.log(`Marked user inactive: ${userId}`);
};

if (require.main === module) {
  runUserRemove().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
