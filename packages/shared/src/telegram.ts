import { getJobConfig } from "./config";

interface TelegramErrorResponse {
  parameters?: {
    migrate_to_chat_id?: number;
  };
}

export const sendTelegramMessage = async (text: string): Promise<void> => {
  const config = getJobConfig();
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

  const send = async (chatId: string | number) => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    });

    const payload = await response.text();
    let parsedPayload: TelegramErrorResponse | undefined;
    try {
      parsedPayload = JSON.parse(payload) as TelegramErrorResponse;
    } catch {
      parsedPayload = undefined;
    }

    return { response, payload, parsedPayload };
  };

  const initial = await send(config.telegramGroupChatId);
  if (initial.response.ok) {
    return;
  }

  const migratedChatId = initial.parsedPayload?.parameters?.migrate_to_chat_id;
  if (migratedChatId !== undefined) {
    const retry = await send(migratedChatId);
    if (retry.response.ok) {
      return;
    }
    throw new Error(`Telegram sendMessage failed: ${retry.response.status} ${retry.payload}`);
  }

  throw new Error(`Telegram sendMessage failed: ${initial.response.status} ${initial.payload}`);
};
