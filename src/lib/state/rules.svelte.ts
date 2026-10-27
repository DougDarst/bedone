import { pb } from '../pb';
import type { IsoDate } from '../recurrence';
import type { RecurringRule, Task } from '../types';
import { connection, isNetworkError } from './connection.svelte';

export type RuleFields = Pick<RecurringRule, 'title' | 'priority' | 'weekdays' | 'month_week' | 'month_weekday'>;

/**
 * Active recurring rules, plus each rule's open instance date, kept current
 * through PocketBase realtime. Creating, editing, and deleting go through the
 * server hooks, which keep the open instance in step (docs/SPEC.md ›
 * Recurrence algorithm).
 */
class RuleStore {
  rules = $state<RecurringRule[]>([]);
  /** Rule id → due date of its open instance. */
  nextDue = $state<Record<string, IsoDate>>({});
  loaded = $state(false);
  error = $state('');

  /** Rule id → id of its open instance, so events about other instances are ignored. */
  #openTask: Record<string, string> = {};
  #subscribed = false;
  #unsubscribers: (() => Promise<void>)[] = [];

  async load(): Promise<void> {
    const result = await this.#call(() =>
      Promise.all([
        pb.collection('recurring_rules').getFullList<RecurringRule>({ filter: "deleted_at = ''", sort: 'created' }),
        pb.collection('tasks').getFullList<Task>({
          filter: "rule != '' && completed_at = ''",
          fields: 'id,rule,due_date',
        }),
      ]),
    );
    if (!result) return;
    const [rules, open] = result;
    this.rules = rules;
    this.nextDue = Object.fromEntries(open.map((t) => [t.rule, t.due_date]));
    this.#openTask = Object.fromEntries(open.map((t) => [t.rule, t.id]));
    this.loaded = true;

    if (!this.#subscribed) {
      this.#subscribed = true;
      this.#unsubscribers = await Promise.all([
        pb.collection('recurring_rules').subscribe<RecurringRule>('*', (e) => {
          if (e.action === 'delete' || e.record.deleted_at) this.#remove(e.record.id);
          else this.#upsert(e.record);
        }),
        pb.collection('tasks').subscribe<Task>('*', (e) => {
          const task = e.record;
          if (!task.rule) return;
          if (e.action !== 'delete' && !task.completed_at) this.#setOpen(task);
          else if (this.#openTask[task.rule] === task.id) this.#clearOpen(task.rule);
        }),
      ]);
    }
  }

  async reset(): Promise<void> {
    this.#subscribed = false;
    // Removes only this store's listeners; the task list may also listen to tasks.
    const unsubscribers = this.#unsubscribers;
    this.#unsubscribers = [];
    await Promise.allSettled(unsubscribers.map((unsubscribe) => unsubscribe()));
    this.rules = [];
    this.nextDue = {};
    this.#openTask = {};
    this.loaded = false;
  }

  async create(frequency: RecurringRule['frequency'], fields: RuleFields): Promise<boolean> {
    const created = await this.#call(() =>
      pb.collection('recurring_rules').create<RecurringRule>({
        owner: pb.authStore.record?.id,
        frequency,
        ...fields,
      }),
    );
    if (created) {
      this.#upsert(created);
      await this.#refreshNextDue(created.id);
    }
    return Boolean(created);
  }

  async update(id: string, fields: Partial<RuleFields>): Promise<boolean> {
    const updated = await this.#call(() => pb.collection('recurring_rules').update<RecurringRule>(id, fields));
    if (updated) {
      this.#upsert(updated);
      await this.#refreshNextDue(id);
    }
    return Boolean(updated);
  }

  /** Deletes the rule and its open instance; completed instances are kept. */
  async remove(id: string): Promise<boolean> {
    const ok = await this.#call(() => pb.send(`/api/recurring-rules/${id}/delete`, { method: 'POST' }));
    if (ok !== null) this.#remove(id);
    return ok !== null;
  }

  async #refreshNextDue(ruleId: string): Promise<void> {
    const open = await this.#call(() =>
      pb.collection('tasks').getList<Task>(1, 1, {
        filter: pb.filter("rule = {:ruleId} && completed_at = ''", { ruleId }),
        fields: 'id,rule,due_date',
      }),
    );
    if (open?.items[0]) this.#setOpen(open.items[0]);
  }

  #setOpen(task: Pick<Task, 'id' | 'rule' | 'due_date'>): void {
    this.nextDue[task.rule] = task.due_date;
    this.#openTask[task.rule] = task.id;
  }

  #clearOpen(ruleId: string): void {
    delete this.nextDue[ruleId];
    delete this.#openTask[ruleId];
  }

  async #call<T>(request: () => Promise<T>): Promise<T | null> {
    this.error = '';
    try {
      return await request();
    } catch (err) {
      if (isNetworkError(err)) connection.markOffline();
      else this.error = (err as { message?: string }).message || 'Something went wrong.';
      return null;
    }
  }

  #upsert(rule: RecurringRule): void {
    const i = this.rules.findIndex((r) => r.id === rule.id);
    if (i === -1) this.rules.push(rule);
    else this.rules[i] = rule;
  }

  #remove(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
    this.#clearOpen(id);
  }
}

export const ruleStore = new RuleStore();
