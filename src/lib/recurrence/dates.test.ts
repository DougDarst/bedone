import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysInMonth,
  fromDayNumber,
  isIsoDate,
  parseIsoDate,
  toDayNumber,
  todayIn,
  weekdayOf,
} from './dates';

describe('parseIsoDate / isIsoDate', () => {
  it('parses a valid date', () => {
    expect(parseIsoDate('2026-10-26')).toEqual({ year: 2026, month: 10, day: 26 });
  });

  it.each(['2026-02-30', '2026-13-01', '2026-00-10', '2026-1-5', '2026-10-26T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false);
      expect(() => parseIsoDate(value)).toThrow();
    },
  );

  it('accepts Feb 29 only in leap years', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2000-02-29')).toBe(true);
    expect(isIsoDate('2100-02-29')).toBe(false);
  });
});

describe('day numbers', () => {
  it('round-trips', () => {
    for (const d of ['1970-01-01', '2026-10-26', '2028-02-29', '2099-12-31']) {
      expect(fromDayNumber(toDayNumber(d))).toBe(d);
    }
  });

  it('counts from the Unix epoch', () => {
    expect(toDayNumber('1970-01-01')).toBe(0);
    expect(toDayNumber('1970-01-02')).toBe(1);
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap days', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('is unaffected by US DST changes (Mar 8 and Nov 1, 2026)', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });
});

describe('weekdayOf', () => {
  it('returns 0 = Sunday … 6 = Saturday', () => {
    expect(weekdayOf('1970-01-01')).toBe(4); // Thursday
    expect(weekdayOf('2000-01-01')).toBe(6); // Saturday
    expect(weekdayOf('2026-10-26')).toBe(1); // Monday
    expect(weekdayOf('2026-11-01')).toBe(0); // Sunday
  });

  it('works before the epoch', () => {
    expect(weekdayOf('1969-12-31')).toBe(3); // Wednesday
  });
});

describe('daysInMonth', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe('todayIn', () => {
  const LA = 'America/Los_Angeles';

  it('uses the Los Angeles date, not the UTC date', () => {
    // 23:30 PDT on Oct 26 is already Oct 27 in UTC.
    expect(todayIn(LA, new Date('2026-10-27T06:30:00Z'))).toBe('2026-10-26');
    expect(todayIn(LA, new Date('2026-10-27T07:30:00Z'))).toBe('2026-10-27');
  });

  it('handles the day DST ends (Nov 1, 2026)', () => {
    // 01:30 PDT, before clocks fall back at 02:00.
    expect(todayIn(LA, new Date('2026-11-01T08:30:00Z'))).toBe('2026-11-01');
    // 23:30 PST that evening (UTC-8 now).
    expect(todayIn(LA, new Date('2026-11-02T07:30:00Z'))).toBe('2026-11-01');
    expect(todayIn(LA, new Date('2026-11-02T08:30:00Z'))).toBe('2026-11-02');
  });

  it('handles the day DST starts (Mar 8, 2026)', () => {
    // 23:30 PDT on Mar 8 (UTC-7).
    expect(todayIn(LA, new Date('2026-03-09T06:30:00Z'))).toBe('2026-03-08');
    expect(todayIn(LA, new Date('2026-03-09T07:30:00Z'))).toBe('2026-03-09');
  });
});
