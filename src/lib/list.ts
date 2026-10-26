/**
 * Task list logic: which tasks and date sections are shown, and in what
 * order. Pure functions, so they're unit tested without a browser.
 * See "Task list (main screen)" and "Design decisions › Task list" in
 * docs/SPEC.md.
 */
import { TIME_ZONE } from './config';
import { addDays, todayIn, weekdayOf, type IsoDate } from './recurrence';
import type { Priority, Task } from './types';

/** How many days after today are always shown, even when empty. */
export const ALWAYS_SHOWN_DAYS = 7;

export type Scope = 'all' | 'today' | 'week';

export interface Filters {
  scope: Scope;
  /** Priorities to show. Empty means all. */
  priorities: Priority[];
}

export const NO_FILTERS: Filters = { scope: 'all', priorities: [] };

export interface DaySection {
  date: IsoDate;
  tasks: Task[];
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Parses a PocketBase datetime ("2026-10-26 20:31:43.123Z"). */
export function parsePbDate(value: string): Date {
  return new Date(value.replace(' ', 'T'));
}

/** The local date a task was completed on, or null if it's open. */
export function completedOn(task: Task, timeZone: string = TIME_ZONE): IsoDate | null {
  return task.completed_at ? todayIn(timeZone, parsePbDate(task.completed_at)) : null;
}

/** Completed tasks stay visible until midnight of the day they were completed. */
export function isVisible(task: Task, today: IsoDate): boolean {
  return !task.completed_at || completedOn(task) === today;
}

/** The Sunday ending the Monday–Sunday week that contains `today`. */
export function endOfWeek(today: IsoDate): IsoDate {
  const weekday = weekdayOf(today); // 0 = Sunday
  return weekday === 0 ? today : addDays(today, 7 - weekday);
}

/**
 * Orders a day's tasks: open tasks by priority, then manual order; completed
 * tasks at the bottom in completion order. Tasks in `settling` were just
 * completed and keep their open position briefly so the row doesn't jump
 * away mid-animation.
 */
export function sortTasks(tasks: Task[], settling: ReadonlySet<string> = new Set()): Task[] {
  const isOpen = (t: Task) => !t.completed_at || settling.has(t.id);
  return [...tasks].sort((a, b) => {
    const openA = isOpen(a);
    const openB = isOpen(b);
    if (openA !== openB) return openA ? -1 : 1;
    if (openA) {
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.sort_order - b.sort_order ||
        a.created.localeCompare(b.created)
      );
    }
    return a.completed_at.localeCompare(b.completed_at);
  });
}

/** The last due date the scope includes (overdue dates are always included). */
function scopeEnd(scope: Scope, today: IsoDate): IsoDate | null {
  if (scope === 'today') return today;
  if (scope === 'week') return endOfWeek(today);
  return null;
}

/**
 * Groups visible tasks into date sections, oldest first.
 * - Today through today + 7 always appear (as drop targets), limited by the scope.
 * - Other dates (past, or beyond the window) appear only if they have tasks.
 */
export function buildSections(
  tasks: Task[],
  today: IsoDate,
  filters: Filters = NO_FILTERS,
  settling: ReadonlySet<string> = new Set(),
): DaySection[] {
  const end = scopeEnd(filters.scope, today);
  const byDate = new Map<IsoDate, Task[]>();

  const windowEnd = addDays(today, ALWAYS_SHOWN_DAYS);
  for (let d = today; d <= windowEnd && (end === null || d <= end); d = addDays(d, 1)) {
    byDate.set(d, []);
  }

  for (const task of tasks) {
    if (!isVisible(task, today)) continue;
    if (filters.priorities.length && !filters.priorities.includes(task.priority)) continue;
    if (end !== null && task.due_date > end) continue;
    const list = byDate.get(task.due_date);
    if (list) list.push(task);
    else byDate.set(task.due_date, [task]);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, tasks: sortTasks(list, settling) }));
}
