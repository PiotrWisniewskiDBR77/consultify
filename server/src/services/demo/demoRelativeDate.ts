export type RelativeDatePreset =
  | 'anchor'
  | 'today'
  | 'currentQuarter'
  | 'currentQuarterStart'
  | 'currentQuarterEnd'
  | 'nextQuarterStart'
  | 'nextQuarterEnd'
  | 'monthStart'
  | 'monthEnd'
  | 'nextBoardMeeting';

export type RelativeDateSpec =
  | string
  | {
      preset?: RelativeDatePreset;
      offsetDays?: number;
      setTimeUtc?: {
        hour: number;
        minute?: number;
      };
    };

export interface RelativeDateOptions {
  anchorDate?: Date | string | null;
  asEndOfDay?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function coerceAnchorDate(anchorDate?: Date | string | null): Date {
  const source = anchorDate ? new Date(anchorDate) : new Date();
  if (Number.isNaN(source.getTime())) {
    throw new Error(`Invalid demo anchor date: ${String(anchorDate)}`);
  }

  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function startOfQuarter(date: Date): Date {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

function endOfQuarter(date: Date): Date {
  const start = startOfQuarter(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function nextBoardMeeting(date: Date): Date {
  // Atelier Toys board rhythm: second Tuesday every month.
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const secondTuesday = (targetYear: number, targetMonth: number): Date => {
    const firstDay = new Date(Date.UTC(targetYear, targetMonth, 1));
    const firstWeekday = firstDay.getUTCDay();
    const delta = (2 - firstWeekday + 7) % 7;
    const firstTuesday = 1 + delta;
    return new Date(Date.UTC(targetYear, targetMonth, firstTuesday + 7));
  };

  const thisMonthMeeting = secondTuesday(year, month);
  if (thisMonthMeeting.getTime() > date.getTime()) return thisMonthMeeting;

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  return secondTuesday(nextYear, nextMonth);
}

function applyPreset(anchor: Date, preset: RelativeDatePreset): Date {
  switch (preset) {
    case 'anchor':
    case 'today':
      return anchor;
    case 'currentQuarter':
    case 'currentQuarterStart':
      return startOfQuarter(anchor);
    case 'currentQuarterEnd':
      return endOfQuarter(anchor);
    case 'nextQuarterStart': {
      const quarterStart = startOfQuarter(anchor);
      return new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth() + 3, 1));
    }
    case 'nextQuarterEnd': {
      const quarterStart = startOfQuarter(anchor);
      return new Date(Date.UTC(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth() + 6, 0));
    }
    case 'monthStart':
      return startOfMonth(anchor);
    case 'monthEnd':
      return endOfMonth(anchor);
    case 'nextBoardMeeting':
      return nextBoardMeeting(anchor);
    default:
      return anchor;
  }
}

function parseStringSpec(spec: string): { preset: RelativeDatePreset; offsetDays: number } {
  const trimmed = spec.trim();
  const presetMatch = trimmed.match(
    /^(anchor|today|currentQuarter|currentQuarterStart|currentQuarterEnd|nextQuarterStart|nextQuarterEnd|monthStart|monthEnd|nextBoardMeeting)([+-]\d+d)?$/i
  );
  if (presetMatch) {
    return {
      preset: presetMatch[1] as RelativeDatePreset,
      offsetDays: presetMatch[2] ? parseInt(presetMatch[2], 10) : 0,
    };
  }

  const dayOffsetMatch = trimmed.match(/^([+-]?\d+)d$/i);
  if (dayOffsetMatch) {
    return {
      preset: 'anchor',
      offsetDays: parseInt(dayOffsetMatch[1], 10),
    };
  }

  throw new Error(`Unsupported relative date spec: ${spec}`);
}

export function materializeRelativeDate(
  spec: RelativeDateSpec,
  options: RelativeDateOptions = {}
): Date {
  const anchor = coerceAnchorDate(options.anchorDate);
  const normalized: { preset: RelativeDatePreset; offsetDays: number; setTimeUtc?: { hour: number; minute?: number } } =
    typeof spec === 'string'
      ? parseStringSpec(spec)
      : {
          preset: spec.preset || 'anchor',
          offsetDays: spec.offsetDays || 0,
          setTimeUtc: spec.setTimeUtc,
        };

  let materialized = addDays(applyPreset(anchor, normalized.preset), normalized.offsetDays);

  if (normalized.setTimeUtc) {
    materialized = new Date(
      Date.UTC(
        materialized.getUTCFullYear(),
        materialized.getUTCMonth(),
        materialized.getUTCDate(),
        normalized.setTimeUtc.hour,
        normalized.setTimeUtc.minute || 0,
        0,
        0
      )
    );
  } else if (options.asEndOfDay) {
    materialized = new Date(
      Date.UTC(
        materialized.getUTCFullYear(),
        materialized.getUTCMonth(),
        materialized.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
  }

  return materialized;
}

export function materializeRelativeIso(
  spec: RelativeDateSpec,
  options: RelativeDateOptions = {}
): string {
  return materializeRelativeDate(spec, options).toISOString();
}

export function getDemoAnchorDate(anchorDate?: Date | string | null): Date {
  return coerceAnchorDate(anchorDate);
}
