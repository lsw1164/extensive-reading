interface WebhookConfig {
  telegramGroupChatId: string;
  webhookSecretToken?: string;
  firebaseServiceAccountJson?: string;
}

interface JobConfig {
  telegramBotToken: string;
  telegramGroupChatId: string;
  finePerMissedCert: number;
  weeklyTargetCount: number;
  firebaseServiceAccountJson?: string;
}

const DEFAULT_WEEKLY_TARGET_COUNT = 3;
const DEFAULT_FINE_PER_MISSED_CERT = 2000;

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const getNumberEnv = (name: string, fallback: number): number => {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number env var: ${name}`);
  }

  return parsed;
};

export const getWebhookConfig = (): WebhookConfig => ({
  telegramGroupChatId: getRequiredEnv("TELEGRAM_GROUP_CHAT_ID"),
  webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
});

export const getJobConfig = (): JobConfig => ({
  telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
  telegramGroupChatId: getRequiredEnv("TELEGRAM_GROUP_CHAT_ID"),
  finePerMissedCert: getNumberEnv("FINE_PER_MISSED_CERT", DEFAULT_FINE_PER_MISSED_CERT),
  weeklyTargetCount: getNumberEnv("WEEKLY_TARGET_COUNT", DEFAULT_WEEKLY_TARGET_COUNT),
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
});
