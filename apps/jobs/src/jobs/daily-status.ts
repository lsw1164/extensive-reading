import {
  countByUserBetween,
  getCurrentWeekRange,
  getJobConfig,
  listActiveManagedUsers,
  sendTelegramMessage
} from "@extensive-reading/shared";

export const runDailyStatus = async (): Promise<void> => {
  const config = getJobConfig();
  const range = getCurrentWeekRange();
  const counts = await countByUserBetween(range.start, range.end);
  const managedUsers = await listActiveManagedUsers(config.telegramGroupChatId);

  const users = new Map<string, { name: string; count: number }>();
  managedUsers.forEach((user) => {
    users.set(user.userId, { name: user.name, count: 0 });
  });

  counts.forEach((value, userId) => {
    const existing = users.get(userId);
    if (existing) {
      existing.count = value.count;
      return;
    }
  });

  const sortedUsers = Array.from(users.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );

  let previousCount: number | undefined;
  let currentRank = 0;

  const lines = sortedUsers.map((entry, index) => {
      const miss = Math.max(config.weeklyTargetCount - entry.count, 0);
      const expectedFine = miss * config.finePerMissedCert;
      const progress = `${entry.count}/${config.weeklyTargetCount}`;
      if (previousCount !== entry.count) {
        currentRank = index + 1;
        previousCount = entry.count;
      }
      const isTie = index > 0 && sortedUsers[index - 1].count === entry.count;
      const rankPrefix = isTie ? "공동 " : "";
      const rank = `${rankPrefix}${currentRank}위`;

      if (entry.count < config.weeklyTargetCount) {
        return [
          `${rank} ${entry.name}`,
          `- 인증 횟수: ${progress}`,
          `- 예상 벌금: ${expectedFine.toLocaleString()}원`
        ].join("\n");
      }

      if (entry.count === config.weeklyTargetCount) {
        return [`${rank} ${entry.name}`, `- 인증 횟수: ${progress}`, "- 상태: 목표 달성"].join("\n");
      }

      return [`${rank} ${entry.name}`, `- 인증 횟수: ${progress}`, "- 상태: 초과 달성"].join("\n");
    });

  const text =
    lines.length > 0
      ? [
          "📘 이번 주 인증 현황",
          `기간: ${range.startLabel} ~ ${range.endLabel}`,
          `목표: 주 ${config.weeklyTargetCount}회 (미달 1회당 ${config.finePerMissedCert.toLocaleString()}원)`,
          "",
          "🏆 랭킹",
          lines.join("\n\n")
        ].join("\n")
      : [
          "📘 이번 주 인증 현황",
          `기간: ${range.startLabel} ~ ${range.endLabel}`,
          `목표: 주 ${config.weeklyTargetCount}회 (미달 1회당 ${config.finePerMissedCert.toLocaleString()}원)`,
          "",
          "🏆 랭킹",
          "- 아직 인증 기록이 없어요. 오늘 한 번 인증해봐요."
        ].join("\n");

  await sendTelegramMessage(text);
};

if (require.main === module) {
  runDailyStatus().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
