import { Participant } from "./types";

interface WebhookConfig {
  telegramGroupChatId: string;
  webhookSecretToken?: string;
  certCaptionRegex?: RegExp;
  firebaseServiceAccountJson?: string;
}

interface JobConfig {
  telegramBotToken: string;
  telegramGroupChatId: string;
  finePerMissedCert: number;
  weeklyTargetCount: number;
  participants: Participant[];
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

const parseParticipants = (raw?: string): Participant[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((pair) => {
      const [id, name] = pair.split(":").map((s) => s.trim());
      if (!id || !name) {
        throw new Error("PARTICIPANTS must be in format 'id:name,id:name'");
      }
      return { id, name };
    });
};

const buildRegex = (pattern?: string): RegExp | undefined => {
  if (!pattern) {
    return undefined;
  }

  return new RegExp(pattern, "i");
};

export const getWebhookConfig = (): WebhookConfig => ({
  telegramGroupChatId: getRequiredEnv("TELEGRAM_GROUP_CHAT_ID"),
  webhookSecretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
  certCaptionRegex: buildRegex(process.env.CERT_CAPTION_REGEX),
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
});

export const getJobConfig = (): JobConfig => ({
  telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
  telegramGroupChatId: getRequiredEnv("TELEGRAM_GROUP_CHAT_ID"),
  finePerMissedCert: getNumberEnv("FINE_PER_MISSED_CERT", DEFAULT_FINE_PER_MISSED_CERT),
  weeklyTargetCount: getNumberEnv("WEEKLY_TARGET_COUNT", DEFAULT_WEEKLY_TARGET_COUNT),
  participants: parseParticipants(process.env.PARTICIPANTS),
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
});
