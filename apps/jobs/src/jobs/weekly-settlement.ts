import {
  countByUserBetween,
  getJobConfig,
  getLastWeekRange,
  listActiveManagedUsers,
  sendTelegramMessage
} from "@extensive-reading/shared";

export const runWeeklySettlement = async (): Promise<void> => {
  const config = getJobConfig();
  const range = getLastWeekRange();
  const counts = await countByUserBetween(range.start, range.end);
  const managedUsers = await listActiveManagedUsers(config.telegramGroupChatId);

  const users = new Map<string, { name: string; count: number }>();
  managedUsers.forEach((user) => {
    users.set(user.userId, { name: user.name, count: 0 });
  });

  counts.forEach((value, userId) => {
    const existing = users.get(userId);
    if (!existing) {
      return;
    }

    existing.count = value.count;
  });

  const lines = Array.from(users.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((entry) => {
      const miss = Math.max(config.weeklyTargetCount - entry.count, 0);
      const fine = miss * config.finePerMissedCert;
      return [
        `${entry.name}`,
        `- 인증: ${entry.count}회`,
        `- 확정 벌금: ${fine.toLocaleString()}원`
      ].join("\n");
    });

  const text =
    lines.length > 0
      ? [
          "💰 지난주 벌금 정산",
          `기간: ${range.startLabel} ~ ${range.endLabel}`,
          `정산 기준: 주 ${config.weeklyTargetCount}회 이상 / 미달 1회당 ${config.finePerMissedCert.toLocaleString()}원`,
          "",
          "🧾 개인별 정산",
          lines.join("\n\n")
        ].join("\n")
      : [
          "💰 지난주 벌금 정산",
          `기간: ${range.startLabel} ~ ${range.endLabel}`,
          `정산 기준: 주 ${config.weeklyTargetCount}회 이상 / 미달 1회당 ${config.finePerMissedCert.toLocaleString()}원`,
          "",
          "🧾 개인별 정산",
          "- 집계 대상 인증 기록이 없어요."
        ].join("\n");

  await sendTelegramMessage(text);
};

if (require.main === module) {
  runWeeklySettlement().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
