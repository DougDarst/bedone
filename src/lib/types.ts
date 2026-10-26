/** Record shapes as returned by the PocketBase API. See docs/SPEC.md › Data model. */
import type { IsoDate } from './recurrence';

export type Priority = 'high' | 'medium' | 'low';
export type TaskType = 'daily' | 'weekly' | 'monthly' | 'one_off';

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface Task {
  id: string;
  owner: string;
  title: string;
  due_date: IsoDate;
  /** Recurring instances only; '' for one-offs. */
  scheduled_date: IsoDate | '';
  priority: Priority;
  notes: string;
  type: TaskType;
  /** '' for one-offs. */
  rule: string;
  is_project: boolean;
  /** PocketBase datetime ("2026-10-26 20:31:43.123Z"), or '' when open. */
  completed_at: string;
  sort_order: number;
  next_instance: string;
  created: string;
  updated: string;
}
