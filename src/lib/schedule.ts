/** Plain-English descriptions of recurring schedules, and helpers for the rule form. */
import type { RecurrenceRule } from './recurrence';
import type { MonthWeekValue, RecurringRule, WeekdayValue } from './types';

/** Monday-first, for display (weeks run Monday–Sunday in this app). */
export const WEEKDAYS_MONDAY_FIRST: readonly WeekdayValue[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_SHORT: Record<WeekdayValue, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

export const WEEKDAY_LONG: Record<WeekdayValue, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

export const MONTH_WEEKS: readonly MonthWeekValue[] = ['1', '2', '3', '4', 'last'];

export const MONTH_WEEK_LABELS: Record<MonthWeekValue, string> = {
  '1': 'First',
  '2': 'Second',
  '3': 'Third',
  '4': 'Fourth',
  last: 'Last',
};

const WORKDAYS: WeekdayValue[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND: WeekdayValue[] = ['sat', 'sun'];

function sameDays(a: readonly WeekdayValue[], b: readonly WeekdayValue[]): boolean {
  return a.length === b.length && b.every((d) => a.includes(d));
}

type Schedule = Pick<RecurringRule, 'frequency' | 'weekdays' | 'month_week' | 'month_weekday'>;

/** "Every day", "Every Tue, Thu", "Weekdays", "Last Friday of each month", … */
export function describeSchedule(rule: Schedule): string {
  if (rule.frequency === 'daily') return 'Every day';
  if (rule.frequency === 'weekly') {
    const days = WEEKDAYS_MONDAY_FIRST.filter((d) => rule.weekdays.includes(d));
    if (days.length === 7) return 'Every day of the week';
    if (sameDays(days, WORKDAYS)) return 'Weekdays';
    if (sameDays(days, WEEKEND)) return 'Weekends';
    return `Every ${days.map((d) => WEEKDAY_SHORT[d]).join(', ')}`;
  }
  if (!rule.month_week || !rule.month_weekday) return 'Monthly';
  return `${MONTH_WEEK_LABELS[rule.month_week]} ${WEEKDAY_LONG[rule.month_weekday]} of each month`;
}

/** Converts a rule record to the shape the recurrence functions take. */
export function toRecurrenceRule(rule: Schedule): RecurrenceRule {
  if (rule.frequency === 'weekly') return { frequency: 'weekly', weekdays: rule.weekdays };
  if (rule.frequency === 'monthly') {
    return {
      frequency: 'monthly',
      monthWeek: rule.month_week === 'last' ? 'last' : (Number(rule.month_week) as 1 | 2 | 3 | 4),
      monthWeekday: rule.month_weekday as WeekdayValue,
    };
  }
  return { frequency: 'daily' };
}
