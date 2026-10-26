import { describe, expect, it } from 'vitest';
import { dayHeading, formatShortDate, formatWeekdayDate } from './format';

describe('date formatting', () => {
  it('formats without shifting the calendar date', () => {
    expect(formatWeekdayDate('2026-10-27')).toBe('Tue, Oct 27');
    expect(formatShortDate('2027-01-01')).toBe('Jan 1');
  });
});

describe('dayHeading (today = Mon Oct 26 2026)', () => {
  const today = '2026-10-26';

  it('labels today', () => {
    expect(dayHeading(today, today)).toEqual({ label: 'Today', detail: 'Mon, Oct 26', kind: 'today' });
  });

  it('labels tomorrow and later days', () => {
    expect(dayHeading('2026-10-27', today)).toEqual({ label: 'Tue, Oct 27', detail: 'Tomorrow', kind: 'future' });
    expect(dayHeading('2026-11-14', today).detail).toBe('In 19 days');
  });

  it('marks past dates overdue only while they have open tasks', () => {
    expect(dayHeading('2026-10-22', today)).toEqual({ label: 'Thu, Oct 22', detail: 'Overdue', kind: 'past' });
    expect(dayHeading('2026-10-22', today, false).detail).toBe('');
  });
});
