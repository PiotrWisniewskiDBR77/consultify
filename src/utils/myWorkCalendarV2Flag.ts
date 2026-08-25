const QUERY = 'ff_myWorkCalendarV2';
const STORAGE = 'ff.my_work_calendar_v2';
const ENV = 'VITE_MY_WORK_CALENDAR_V2';
const parse = (value: string | null | undefined) =>
  value == null
    ? null
    : ['1', 'true', 'on'].includes(value.toLowerCase())
      ? true
      : ['0', 'false', 'off'].includes(value.toLowerCase())
        ? false
        : null;
let cached: boolean | null = null;
export const isMyWorkCalendarV2Enabled = () => {
  if (cached !== null) return cached;
  const query =
    typeof window === 'undefined'
      ? null
      : parse(new URLSearchParams(window.location.search).get(QUERY));
  const local =
    query === null && typeof window !== 'undefined'
      ? parse(window.localStorage.getItem(STORAGE))
      : null;
  const env = parse((import.meta as unknown as { env?: Record<string, string> }).env?.[ENV]);
  return (cached = query ?? local ?? env ?? false);
};
export const resetMyWorkCalendarV2FlagCache = () => {
  cached = null;
};
export const MY_WORK_CALENDAR_V2_FLAG_KEYS = {
  query: QUERY,
  localStorage: STORAGE,
  env: ENV,
} as const;
