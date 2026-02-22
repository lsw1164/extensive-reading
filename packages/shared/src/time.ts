import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

const KST = "Asia/Seoul";
const DAILY_CUTOFF_HOUR = 2;
const NEXT_WINDOW_START_MINUTE = 1;

const getCurrentWeekStart = () => {
  const now = dayjs().tz(KST);
  const thisWeekStart = now
    .startOf("isoWeek")
    .startOf("day")
    .add(DAILY_CUTOFF_HOUR, "hour")
    .add(NEXT_WINDOW_START_MINUTE, "minute");

  if (now.isBefore(thisWeekStart)) {
    return thisWeekStart.subtract(1, "week");
  }

  return thisWeekStart;
};

const formatLabel = (value: dayjs.Dayjs): string => value.format("MM-DD HH:mm");
const getDisplayEnd = (exclusiveEnd: dayjs.Dayjs): dayjs.Dayjs => exclusiveEnd.subtract(1, "minute");

export const getCertDayKey = (date: Date): string =>
  dayjs(date)
    .tz(KST)
    .subtract(DAILY_CUTOFF_HOUR, "hour")
    .subtract(NEXT_WINDOW_START_MINUTE, "minute")
    .format("YYYY-MM-DD");

export const getCurrentWeekRange = () => {
  const start = getCurrentWeekStart();
  const end = start.add(1, "week");

  return {
    start: start.toDate(),
    end: end.toDate(),
    startLabel: formatLabel(start),
    endLabel: formatLabel(getDisplayEnd(end))
  };
};

export const getLastWeekRange = () => {
  const end = getCurrentWeekStart();
  const start = end.subtract(1, "week");

  return {
    start: start.toDate(),
    end: end.toDate(),
    startLabel: formatLabel(start),
    endLabel: formatLabel(getDisplayEnd(end))
  };
};
