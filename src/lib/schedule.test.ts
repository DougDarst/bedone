import { describe, expect, it } from 'vitest';
import { firstOccurrence } from './recurrence';
import { describeSchedule, toRecurrenceRule } from './schedule';
import type { WeekdayValue } from './types';

const weekly = (...weekdays: WeekdayValue[]) =>
  ({ frequency: 'weekly', weekdays, month_week: '', month_weekday: '' }) as const;

describe('describeSchedule', () => {
  it('describes daily rules', () => {
    expect(describeSchedule({ frequency: 'daily', weekdays: [], month_week: '', month_weekday: '' })).toBe(
      'Every day',
    );
  });

  it('lists weekly days Monday-first, whatever order they are stored in', () => {
    expect(describeSchedule(weekly('thu', 'tue'))).toBe('Every Tue, Thu');
    expect(describeSchedule(weekly('sun', 'mon'))).toBe('Every Mon, Sun');
  });

  it('names common weekly patterns', () => {
    expect(describeSchedule(weekly('mon', 'tue', 'wed', 'thu', 'fri'))).toBe('Weekdays');
    expect(describeSchedule(weekly('sun', 'sat'))).toBe('Weekends');
    expect(describeSchedule(weekly('sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'))).toBe('Every day of the week');
  });

  it('describes monthly rules', () => {
    expect(describeSchedule({ frequency: 'monthly', weekdays: [], month_week: '1', month_weekday: 'mon' })).toBe(
      'First Monday of each month',
    );
    expect(describeSchedule({ frequency: 'monthly', weekdays: [], month_week: 'last', month_weekday: 'fri' })).toBe(
      'Last Friday of each month',
    );
  });
});

describe('toRecurrenceRule', () => {
  it('converts records for the recurrence functions', () => {
    expect(toRecurrenceRule(weekly('tue', 'thu'))).toEqual({ frequency: 'weekly', weekdays: ['tue', 'thu'] });
    const monthly = toRecurrenceRule({ frequency: 'monthly', weekdays: [], month_week: '3', month_weekday: 'wed' });
    expect(monthly).toEqual({ frequency: 'monthly', monthWeek: 3, monthWeekday: 'wed' });
    // Third Wednesday of November 2026 is the 18th.
    expect(firstOccurrence(monthly, '2026-11-01')).toBe('2026-11-18');
  });
});
