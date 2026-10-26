/** Display formatting for dates. All inputs are date-only `YYYY-MM-DD` strings. */
import { parseIsoDate, toDayNumber, type IsoDate } from './recurrence';

function asUtcDate(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

// Formatting in UTC keeps the calendar date exactly as stored.
const weekdayDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const monthDay = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** "Tue, Oct 27" */
export function formatWeekdayDate(date: IsoDate): string {
  return weekdayDate.format(asUtcDate(date));
}

/** "Oct 27" */
export function formatShortDate(date: IsoDate): string {
  return monthDay.format(asUtcDate(date));
}

export interface DayHeading {
  /** Main heading text. */
  label: string;
  /** Secondary text beside it. */
  detail: string;
  kind: 'past' | 'today' | 'future';
}

/**
 * Heading for a date section, relative to today. A past section says
 * "Overdue" only while it still has open tasks (it may hold only tasks
 * completed today).
 */
export function dayHeading(date: IsoDate, today: IsoDate, hasOpenTasks = true): DayHeading {
  const diff = toDayNumber(date) - toDayNumber(today);
  if (diff === 0) return { label: 'Today', detail: formatWeekdayDate(date), kind: 'today' };
  if (diff < 0) {
    return { label: formatWeekdayDate(date), detail: hasOpenTasks ? 'Overdue' : '', kind: 'past' };
  }
  return {
    label: formatWeekdayDate(date),
    detail: diff === 1 ? 'Tomorrow' : `In ${diff} days`,
    kind: 'future',
  };
}
