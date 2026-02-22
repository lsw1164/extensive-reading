interface WebhookConfig {
  telegramGroupChatId: string;
  telegramBotToken?: string;
  webhookSecretToken?: string;
  certCaptionRegex?: RegExp;
  firebaseServiceAccountJson?: string;
}

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const buildRegex = (pattern?: string): RegExp | undefined => {
  if (!pattern) {
    return undefined;
  }

  return new RegExp(pattern, "i");
};

export const getWebhookConfig = (): WebhookConfig => ({
  telegramGroupChatId: getRequiredEnv("TELEGRAM_GROUP_CHAT_ID"),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  certCaptionRegex: buildRegex(process.env.CERT_CAPTION_REGEX),
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
});
