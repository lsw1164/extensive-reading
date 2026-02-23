import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "./firebase";

export interface ManagedUser {
  userId: string;
  name: string;
  chatId?: string;
  isActive: boolean;
}

interface UpsertManagedUserInput {
  userId: string;
  name: string;
  chatId?: string;
  source: "manual" | "telegram_message" | "telegram_chat_member";
  username?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
  isActive?: boolean;
}

const usersCollection = () => getDb().collection("users");

const normalizeName = (name: string, userId: string): string => {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed;
  }

  return `user_${userId}`;
};

export const upsertManagedUser = async (
  input: UpsertManagedUserInput,
): Promise<void> => {
  const now = Timestamp.now();
  const userId = String(input.userId);

  await usersCollection()
    .doc(userId)
    .set(
      {
        user_id: userId,
        display_name: normalizeName(input.name, userId),
        chat_id: input.chatId,
        username: input.username,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        status: input.status,
        is_active: input.isActive ?? true,
        source: input.source,
        updated_at: now,
        created_at: now,
      },
      { merge: true },
    );
};

export const setManagedUserActive = async (
  userId: string,
  isActive: boolean,
  reason: string,
): Promise<void> => {
  const now = Timestamp.now();

  await usersCollection()
    .doc(String(userId))
    .set(
      {
        user_id: String(userId),
        is_active: isActive,
        status: isActive ? "member" : "left",
        source: "manual",
        updated_at: now,
        deactivated_reason: isActive ? null : reason,
        deactivated_at: isActive ? null : now,
        reactivated_at: isActive ? now : null,
        created_at: now,
      },
      { merge: true },
    );
};

export const listActiveManagedUsers = async (
  chatId?: string,
): Promise<ManagedUser[]> => {
  let query = usersCollection().where("is_active", "==", true);
  if (chatId) {
    query = query.where("chat_id", "==", chatId);
  }

  const snap = await query.get();
  return snap.docs
    .map((doc) => {
      const data = doc.data();
      const userId = String(data.user_id ?? doc.id);
      const name = String(data.display_name ?? "").trim() || `user_${userId}`;
      return {
        userId,
        name,
        chatId: data.chat_id ? String(data.chat_id) : undefined,
        isActive: Boolean(data.is_active),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};
