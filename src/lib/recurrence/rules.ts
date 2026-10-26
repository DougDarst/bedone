/**
 * Recurrence rules: which dates a recurring task falls on, and how to find
 * the first and next instance dates. See "Recurrence algorithm" in
 * docs/SPEC.md.
 *
 * Like dates.ts, this module must stay dependency-free so it can be bundled
 * into the PocketBase hooks.
 */
import {
  addDays,
  daysInMonth,
  formatIsoDate,
  parseIsoDate,
  weekdayOf,
  type IsoDate,
  type WeekdayIndex,
} from './dates';

/** Weekday values as stored in PocketBase select fields. */
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Which occurrence of the weekday in the month. No "5th": most months lack one. */
export type MonthWeek = 1 | 2 | 3 | 4 | 'last';

export type RecurrenceRule =
  | { frequency: 'daily' }
  | { frequency: 'weekly'; weekdays: readonly Weekday[] }
  | { frequency: 'monthly'; monthWeek: MonthWeek; monthWeekday: Weekday };

function weekdayIndex(weekday: Weekday): WeekdayIndex {
  return WEEKDAYS.indexOf(weekday) as WeekdayIndex;
}

/** Throws a descriptive error if the rule cannot produce dates. */
export function assertValidRule(rule: RecurrenceRule): void {
  switch (rule.frequency) {
    case 'daily':
      return;
    case 'weekly':
      if (rule.weekdays.length === 0) throw new Error('A weekly rule needs at least one weekday');
      for (const day of rule.weekdays) {
        if (!WEEKDAYS.includes(day)) throw new Error(`Unknown weekday "${day}"`);
      }
      return;
    case 'monthly':
      if (![1, 2, 3, 4, 'last'].includes(rule.monthWeek)) {
        throw new Error(`Invalid month week "${rule.monthWeek}"`);
      }
      if (!WEEKDAYS.includes(rule.monthWeekday)) {
        throw new Error(`Unknown weekday "${rule.monthWeekday}"`);
      }
      return;
    default:
      throw new Error(`Unknown frequency "${(rule as { frequency: string }).frequency}"`);
  }
}

/**
 * The date of the Nth (or last) given weekday in a month.
 * Example: the last Friday of October 2026 is 2026-10-30.
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: Weekday,
  monthWeek: MonthWeek,
): IsoDate {
  const target = weekdayIndex(weekday);
  if (monthWeek === 'last') {
    const lastDay = daysInMonth(year, month);
    const lastDate = formatIsoDate({ year, month, day: lastDay });
    const back = (weekdayOf(lastDate) - target + 7) % 7;
    return formatIsoDate({ year, month, day: lastDay - back });
  }
  const firstDate = formatIsoDate({ year, month, day: 1 });
  const forward = (target - weekdayOf(firstDate) + 7) % 7;
  return formatIsoDate({ year, month, day: 1 + forward + (monthWeek - 1) * 7 });
}

/** Whether the rule produces an instance on this date. */
export function matchesRule(rule: RecurrenceRule, date: IsoDate): boolean {
  switch (rule.frequency) {
    case 'daily':
      return true;
    case 'weekly':
      return rule.weekdays.some((day) => weekdayIndex(day) === weekdayOf(date));
    case 'monthly': {
      const { year, month } = parseIsoDate(date);
      return nthWeekdayOfMonth(year, month, rule.monthWeekday, rule.monthWeek) === date;
    }
  }
}

/**
 * The earliest date strictly after `after` that matches the rule.
 *
 * When an instance is completed, pass its ORIGINAL scheduled date, never its
 * (possibly moved) due date or the completion date.
 */
export function nextOccurrence(rule: RecurrenceRule, after: IsoDate): IsoDate {
  assertValidRule(rule);
  switch (rule.frequency) {
    case 'daily':
      return addDays(after, 1);
    case 'weekly': {
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(after, i);
        if (matchesRule(rule, candidate)) return candidate;
      }
      throw new Error('Unreachable: a valid weekly rule matches within 7 days');
    }
    case 'monthly': {
      const { year, month } = parseIsoDate(after);
      const thisMonth = nthWeekdayOfMonth(year, month, rule.monthWeekday, rule.monthWeek);
      if (thisMonth > after) return thisMonth;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonth = month === 12 ? 1 : month + 1;
      return nthWeekdayOfMonth(nextYear, nextMonth, rule.monthWeekday, rule.monthWeek);
    }
  }
}

/** The earliest date on or after `today` that matches the rule: a new rule's first instance. */
export function firstOccurrence(rule: RecurrenceRule, today: IsoDate): IsoDate {
  return nextOccurrence(rule, addDays(today, -1));
}
