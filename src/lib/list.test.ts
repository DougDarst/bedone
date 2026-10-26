import { describe, expect, it } from 'vitest';
import { buildSections, completedOn, endOfWeek, isVisible, sortTasks, type Filters } from './list';
import type { Task } from './types';

// Mon Oct 26, 2026. Los Angeles is UTC-7 (PDT) on this date.
const TODAY = '2026-10-26';

let seq = 0;
function task(fields: Partial<Task> = {}): Task {
  seq++;
  return {
    id: `t${seq}`,
    owner: 'u1',
    title: `Task ${seq}`,
    due_date: TODAY,
    scheduled_date: '',
    priority: 'medium',
    notes: '',
    type: 'one_off',
    rule: '',
    is_project: false,
    completed_at: '',
    sort_order: seq,
    next_instance: '',
    created: `2026-10-01 00:00:${String(seq % 60).padStart(2, '0')}.000Z`,
    updated: '',
    ...fields,
  };
}

const titles = (tasks: Task[]) => tasks.map((t) => t.title);
const dates = (sections: { date: string }[]) => sections.map((s) => s.date);

describe('completedOn', () => {
  it('converts the completion time to the Los Angeles date', () => {
    // 23:30 PDT on Oct 26 is 06:30 UTC on Oct 27.
    expect(completedOn(task({ completed_at: '2026-10-27 06:30:00.000Z' }))).toBe('2026-10-26');
    expect(completedOn(task({ completed_at: '2026-10-27 07:30:00.000Z' }))).toBe('2026-10-27');
    expect(completedOn(task())).toBeNull();
  });
});

describe('isVisible', () => {
  it('shows open tasks', () => {
    expect(isVisible(task({ due_date: '2026-01-01' }), TODAY)).toBe(true);
  });

  it('shows tasks completed today until midnight, then hides them', () => {
    const lateTonight = task({ completed_at: '2026-10-27 06:59:00.000Z' }); // 23:59 PDT
    expect(isVisible(lateTonight, TODAY)).toBe(true);
    expect(isVisible(lateTonight, '2026-10-27')).toBe(false);
    expect(isVisible(task({ completed_at: '2026-10-26 06:00:00.000Z' }), TODAY)).toBe(false); // Oct 25 PDT
  });
});

describe('endOfWeek (Monday–Sunday)', () => {
  it('returns the coming Sunday', () => {
    expect(endOfWeek('2026-10-26')).toBe('2026-11-01'); // Monday
    expect(endOfWeek('2026-10-29')).toBe('2026-11-01'); // Thursday
  });

  it('returns today on a Sunday', () => {
    expect(endOfWeek('2026-11-01')).toBe('2026-11-01');
  });

  it('crosses the year boundary', () => {
    expect(endOfWeek('2026-12-30')).toBe('2027-01-03');
  });
});

describe('sortTasks', () => {
  it('orders open tasks by priority, then manual order', () => {
    const tasks = [
      task({ title: 'low', priority: 'low', sort_order: 1 }),
      task({ title: 'high-2', priority: 'high', sort_order: 20 }),
      task({ title: 'medium', priority: 'medium', sort_order: 5 }),
      task({ title: 'high-1', priority: 'high', sort_order: 10 }),
    ];
    expect(titles(sortTasks(tasks))).toEqual(['high-1', 'high-2', 'medium', 'low']);
  });

  it('puts completed tasks at the bottom in completion order', () => {
    const tasks = [
      task({ title: 'done-late', priority: 'high', completed_at: '2026-10-26 20:00:00.000Z' }),
      task({ title: 'open-low', priority: 'low' }),
      task({ title: 'done-early', priority: 'low', completed_at: '2026-10-26 18:00:00.000Z' }),
      task({ title: 'open-high', priority: 'high' }),
    ];
    expect(titles(sortTasks(tasks))).toEqual(['open-high', 'open-low', 'done-early', 'done-late']);
  });

  it('keeps just-completed (settling) tasks in their open position', () => {
    const done = task({ title: 'just-done', priority: 'high', completed_at: '2026-10-26 20:00:00.000Z' });
    const open = task({ title: 'open', priority: 'low' });
    expect(titles(sortTasks([open, done], new Set([done.id])))).toEqual(['just-done', 'open']);
    expect(titles(sortTasks([open, done]))).toEqual(['open', 'just-done']);
  });

  it('falls back to creation time when manual order ties', () => {
    const a = task({ title: 'a', sort_order: 1, created: '2026-10-01 10:00:00.000Z' });
    const b = task({ title: 'b', sort_order: 1, created: '2026-10-01 09:00:00.000Z' });
    expect(titles(sortTasks([a, b]))).toEqual(['b', 'a']);
  });
});

describe('buildSections', () => {
  it('always shows today and the next 7 days, even when empty', () => {
    expect(dates(buildSections([], TODAY))).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('shows past dates only when they have open tasks or tasks completed today', () => {
    const sections = buildSections(
      [
        task({ due_date: '2026-10-20' }), // open, overdue
        task({ due_date: '2026-10-21', completed_at: '2026-10-26 18:00:00.000Z' }), // completed today
        task({ due_date: '2026-10-22', completed_at: '2026-10-24 18:00:00.000Z' }), // completed earlier
      ],
      TODAY,
    );
    expect(dates(sections).slice(0, 3)).toEqual(['2026-10-20', '2026-10-21', '2026-10-26']);
  });

  it('keeps an overdue task completed today in its original date section', () => {
    const t = task({ due_date: '2026-10-18', completed_at: '2026-10-26 18:00:00.000Z' });
    const section = buildSections([t], TODAY).find((s) => s.date === '2026-10-18');
    expect(section?.tasks).toEqual([t]);
  });

  it('shows future dates beyond the window when they have tasks', () => {
    const sections = buildSections([task({ due_date: '2026-11-14' })], TODAY);
    expect(dates(sections).at(-1)).toBe('2026-11-14');
    expect(sections).toHaveLength(9);
  });

  it('sorts tasks within each section', () => {
    const sections = buildSections(
      [task({ title: 'low', priority: 'low' }), task({ title: 'high', priority: 'high' })],
      TODAY,
    );
    expect(titles(sections[0]!.tasks)).toEqual(['high', 'low']);
  });

  describe('filters', () => {
    const tasks = [
      task({ title: 'overdue-high', due_date: '2026-10-20', priority: 'high' }),
      task({ title: 'today-low', priority: 'low' }),
      task({ title: 'sunday-medium', due_date: '2026-11-01' }),
      task({ title: 'next-monday-high', due_date: '2026-11-02', priority: 'high' }),
      task({ title: 'far-medium', due_date: '2026-12-01' }),
    ];
    const visibleTitles = (filters: Filters) =>
      buildSections(tasks, TODAY, filters).flatMap((s) => titles(s.tasks));

    it('"Today" shows overdue and today only', () => {
      const sections = buildSections(tasks, TODAY, { scope: 'today', priorities: [] });
      expect(dates(sections)).toEqual(['2026-10-20', '2026-10-26']);
      expect(visibleTitles({ scope: 'today', priorities: [] })).toEqual(['overdue-high', 'today-low']);
    });

    it('"This week" shows overdue through Sunday', () => {
      const sections = buildSections(tasks, TODAY, { scope: 'week', priorities: [] });
      expect(dates(sections)).toEqual([
        '2026-10-20',
        '2026-10-26',
        '2026-10-27',
        '2026-10-28',
        '2026-10-29',
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
      ]);
      expect(visibleTitles({ scope: 'week', priorities: [] })).toEqual([
        'overdue-high',
        'today-low',
        'sunday-medium',
      ]);
    });

    it('"This week" on a Sunday shows overdue and today only', () => {
      const sections = buildSections(tasks, '2026-11-01', { scope: 'week', priorities: [] });
      expect(dates(sections)).toEqual(['2026-10-20', '2026-10-26', '2026-11-01']);
    });

    it('priority chips can be combined', () => {
      expect(visibleTitles({ scope: 'all', priorities: ['high'] })).toEqual(['overdue-high', 'next-monday-high']);
      expect(visibleTitles({ scope: 'all', priorities: ['high', 'low'] })).toEqual([
        'overdue-high',
        'today-low',
        'next-monday-high',
      ]);
    });

    it('scope and priority combine', () => {
      expect(visibleTitles({ scope: 'today', priorities: ['high'] })).toEqual(['overdue-high']);
    });

    it('still shows the empty window days when filtering by priority', () => {
      expect(buildSections(tasks, TODAY, { scope: 'all', priorities: ['low'] })).toHaveLength(8);
    });
  });
});
