/**
 * Date-only helpers. Every date in the app is a plain calendar date string,
 * `YYYY-MM-DD`, with no time or time zone attached. Arithmetic is done on
 * whole day numbers, so daylight saving time can never shift a result.
 *
 * This module must stay dependency-free: it is also bundled into the
 * PocketBase hooks, which run in a minimal JavaScript engine.
 */

/** A calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string;

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getUTCDay`. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
}

/** Parses a `YYYY-MM-DD` string, throwing if it is malformed or not a real date. */
export function parseIsoDate(value: IsoDate): DateParts {
  const match = ISO_DATE.exec(value);
  if (!match) throw new Error(`Invalid date "${value}": expected YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Invalid date "${value}": no such day`);
  }
  return { year, month, day };
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatIsoDate({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Days since 1970-01-01. */
export function toDayNumber(value: IsoDate): number {
  const { year, month, day } = parseIsoDate(value);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const date = new Date(dayNumber * MS_PER_DAY);
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(value) + days);
}

export function weekdayOf(value: IsoDate): WeekdayIndex {
  // 1970-01-01 was a Thursday (4).
  return ((((toDayNumber(value) + 4) % 7) + 7) % 7) as WeekdayIndex;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today's date in the given IANA time zone, e.g. `America/Los_Angeles`. */
export function todayIn(timeZone: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return formatIsoDate({ year: get('year'), month: get('month'), day: get('day') });
}
