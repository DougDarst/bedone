import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from './dates';
import {
  assertValidRule,
  firstOccurrence,
  matchesRule,
  nextOccurrence,
  nthWeekdayOfMonth,
  WEEKDAYS,
  type MonthWeek,
  type RecurrenceRule,
} from './rules';

const daily: RecurrenceRule = { frequency: 'daily' };
const weekly = (...weekdays: (typeof WEEKDAYS)[number][]): RecurrenceRule => ({
  frequency: 'weekly',
  weekdays,
});
const monthly = (monthWeek: MonthWeek, monthWeekday: (typeof WEEKDAYS)[number]): RecurrenceRule => ({
  frequency: 'monthly',
  monthWeek,
  monthWeekday,
});

/** Follows a chain of completions: each next instance from the previous scheduled date. */
function chain(rule: RecurrenceRule, start: IsoDate, count: number): IsoDate[] {
  const dates = [start];
  for (let i = 1; i < count; i++) dates.push(nextOccurrence(rule, dates[i - 1]!));
  return dates;
}

describe('nthWeekdayOfMonth', () => {
  it('finds the Nth weekday', () => {
    expect(nthWeekdayOfMonth(2026, 11, 'mon', 1)).toBe('2026-11-02');
    expect(nthWeekdayOfMonth(2026, 12, 'mon', 1)).toBe('2026-12-07');
    expect(nthWeekdayOfMonth(2026, 11, 'thu', 4)).toBe('2026-11-26'); // Thanksgiving
  });

  it('handles the 1st of the month being the target weekday', () => {
    expect(nthWeekdayOfMonth(2026, 11, 'sun', 1)).toBe('2026-11-01');
  });

  it('finds the last weekday', () => {
    expect(nthWeekdayOfMonth(2026, 10, 'fri', 'last')).toBe('2026-10-30');
    expect(nthWeekdayOfMonth(2026, 11, 'fri', 'last')).toBe('2026-11-27');
    expect(nthWeekdayOfMonth(2026, 12, 'fri', 'last')).toBe('2026-12-25');
  });

  it('handles the last day of the month being the target weekday', () => {
    expect(nthWeekdayOfMonth(2026, 10, 'sat', 'last')).toBe('2026-10-31');
    expect(nthWeekdayOfMonth(2027, 2, 'sun', 'last')).toBe('2027-02-28');
  });

  it('handles leap-year February', () => {
    expect(nthWeekdayOfMonth(2028, 2, 'tue', 'last')).toBe('2028-02-29');
  });
});

describe('matchesRule', () => {
  it('daily matches every date', () => {
    expect(matchesRule(daily, '2026-10-26')).toBe(true);
    expect(matchesRule(daily, '2028-02-29')).toBe(true);
  });

  it('weekly matches only the chosen weekdays', () => {
    const tueThu = weekly('tue', 'thu');
    expect(matchesRule(tueThu, '2026-10-27')).toBe(true); // Tue
    expect(matchesRule(tueThu, '2026-10-29')).toBe(true); // Thu
    expect(matchesRule(tueThu, '2026-10-28')).toBe(false); // Wed
  });

  it('monthly matches only the Nth weekday', () => {
    expect(matchesRule(monthly(1, 'mon'), '2026-11-02')).toBe(true);
    expect(matchesRule(monthly(1, 'mon'), '2026-11-09')).toBe(false); // 2nd Monday
    expect(matchesRule(monthly('last', 'fri'), '2026-10-30')).toBe(true);
    expect(matchesRule(monthly('last', 'fri'), '2026-10-23')).toBe(false);
  });
});

describe('firstOccurrence (new rule, today = Mon Oct 26 2026 unless stated)', () => {
  it('daily starts today', () => {
    expect(firstOccurrence(daily, '2026-10-26')).toBe('2026-10-26');
  });

  it('a Tue/Thu rule created on a Wednesday starts Thursday', () => {
    expect(firstOccurrence(weekly('tue', 'thu'), '2026-10-28')).toBe('2026-10-29');
  });

  it('includes today when today matches', () => {
    expect(firstOccurrence(weekly('tue', 'thu'), '2026-10-27')).toBe('2026-10-27');
    expect(firstOccurrence(monthly(1, 'mon'), '2026-11-02')).toBe('2026-11-02');
  });

  it('moves to next month once this month’s date has passed', () => {
    expect(firstOccurrence(monthly(1, 'mon'), '2026-11-03')).toBe('2026-12-07');
  });

  it('crosses the year boundary', () => {
    expect(firstOccurrence(monthly('last', 'fri'), '2026-12-26')).toBe('2027-01-29');
    expect(firstOccurrence(weekly('sun'), '2026-12-31')).toBe('2027-01-03');
  });
});

describe('nextOccurrence', () => {
  it('daily: the next day, across year end', () => {
    expect(nextOccurrence(daily, '2026-10-26')).toBe('2026-10-27');
    expect(nextOccurrence(daily, '2026-12-31')).toBe('2027-01-01');
  });

  it('weekly Tue/Thu: Tuesday → Thursday → next Tuesday', () => {
    expect(chain(weekly('tue', 'thu'), '2026-10-27', 4)).toEqual([
      '2026-10-27',
      '2026-10-29',
      '2026-11-03',
      '2026-11-05',
    ]);
  });

  it('weekly with a single day jumps a full week', () => {
    expect(nextOccurrence(weekly('mon'), '2026-10-26')).toBe('2026-11-02');
  });

  it('weekly across the year boundary', () => {
    expect(nextOccurrence(weekly('mon', 'fri'), '2026-12-28')).toBe('2027-01-01');
  });

  it('weekly order of chosen days does not matter', () => {
    expect(nextOccurrence(weekly('thu', 'tue'), '2026-10-27')).toBe('2026-10-29');
  });

  it('monthly first Monday', () => {
    expect(chain(monthly(1, 'mon'), '2026-11-02', 3)).toEqual([
      '2026-11-02',
      '2026-12-07',
      '2027-01-04',
    ]);
  });

  it('monthly last Friday across the year boundary', () => {
    expect(chain(monthly('last', 'fri'), '2026-10-30', 4)).toEqual([
      '2026-10-30',
      '2026-11-27',
      '2026-12-25',
      '2027-01-29',
    ]);
  });

  it('monthly returns this month’s date when it is still ahead', () => {
    expect(nextOccurrence(monthly('last', 'fri'), '2026-10-01')).toBe('2026-10-30');
  });

  it('is unaffected by DST changes', () => {
    expect(nextOccurrence(weekly('sun'), '2026-10-31')).toBe('2026-11-01'); // DST ends
    expect(nextOccurrence(weekly('sun'), '2026-03-07')).toBe('2026-03-08'); // DST starts
    expect(nextOccurrence(daily, '2026-11-01')).toBe('2026-11-02');
    expect(nextOccurrence(monthly(2, 'sun'), '2026-03-01')).toBe('2026-03-08');
  });
});

describe('moved instances: the next date comes from the scheduled date', () => {
  it('weekly Monday dragged to Tuesday: next is still Monday', () => {
    const scheduled = '2026-10-26';
    // Due date moved to 2026-10-27 and completed then; neither is used.
    expect(nextOccurrence(weekly('mon'), scheduled)).toBe('2026-11-02');
  });

  it('weekly Tue/Thu: Tuesday instance moved to Thursday still yields Thursday', () => {
    const rule = weekly('tue', 'thu');
    const scheduled = '2026-10-27';
    const movedTo = '2026-10-29';
    expect(nextOccurrence(rule, scheduled)).toBe('2026-10-29');
    // Using the moved due date would wrongly skip ahead.
    expect(nextOccurrence(rule, movedTo)).toBe('2026-11-03');
  });

  it('monthly last Friday moved into the next month', () => {
    // Oct 30 instance moved to Nov 2: next is still Nov's last Friday.
    expect(nextOccurrence(monthly('last', 'fri'), '2026-10-30')).toBe('2026-11-27');
  });
});

describe('late completion creates catch-up instances one at a time', () => {
  it('daily due Oct 1, completed Oct 4: Oct 2, then Oct 3, Oct 4, Oct 5', () => {
    expect(chain(daily, '2026-10-01', 5)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
  });

  it('weekly: completing a 3-week-old Monday yields the following Monday', () => {
    expect(nextOccurrence(weekly('mon'), '2026-10-05')).toBe('2026-10-12');
  });

  it('monthly: completing August’s first Monday in late October yields September’s', () => {
    expect(nextOccurrence(monthly(1, 'mon'), '2026-08-03')).toBe('2026-09-07');
  });
});

describe('exhaustive checks, 2026 through 2028', () => {
  const allDays: IsoDate[] = [];
  for (let d = '2026-01-01'; d <= '2028-12-31'; d = addDays(d, 1)) allDays.push(d);

  const rules: RecurrenceRule[] = [
    daily,
    weekly('mon'),
    weekly('tue', 'thu'),
    weekly('sun', 'sat'),
    ...([1, 2, 3, 4, 'last'] as const).flatMap((n) => WEEKDAYS.map((wd) => monthly(n, wd))),
  ];

  it('next is the earliest matching date strictly after the input', () => {
    for (const rule of rules) {
      for (const after of allDays) {
        const next = nextOccurrence(rule, after);
        expect(next > after).toBe(true);
        expect(matchesRule(rule, next)).toBe(true);
        for (let d = addDays(after, 1); d < next; d = addDays(d, 1)) {
          if (matchesRule(rule, d)) throw new Error(`${JSON.stringify(rule)}: skipped ${d} after ${after}`);
        }
      }
    }
  });

  it('every monthly rule matches exactly once per month', () => {
    for (const rule of rules.filter((r) => r.frequency === 'monthly')) {
      const perMonth = new Map<string, number>();
      for (const d of allDays) {
        if (matchesRule(rule, d)) perMonth.set(d.slice(0, 7), (perMonth.get(d.slice(0, 7)) ?? 0) + 1);
      }
      expect(perMonth.size).toBe(36);
      expect([...perMonth.values()].every((n) => n === 1)).toBe(true);
    }
  });
});

describe('assertValidRule', () => {
  it('rejects a weekly rule with no weekdays', () => {
    expect(() => assertValidRule(weekly())).toThrow(/at least one weekday/);
    expect(() => nextOccurrence(weekly(), '2026-10-26')).toThrow();
  });

  it('rejects an unsupported month week', () => {
    expect(() =>
      assertValidRule({ frequency: 'monthly', monthWeek: 5 as unknown as MonthWeek, monthWeekday: 'mon' }),
    ).toThrow(/month week/);
  });

  it('rejects unknown weekdays and frequencies', () => {
    expect(() => assertValidRule(weekly('funday' as 'mon'))).toThrow(/weekday/);
    expect(() => assertValidRule({ frequency: 'yearly' } as unknown as RecurrenceRule)).toThrow(/frequency/);
  });
});
