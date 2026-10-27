import type { RecordModel } from 'pocketbase';
import { pb } from '../pb';
import type { IsoDate } from '../recurrence';
import type { Priority, Task } from '../types';
import { connection, isNetworkError } from './connection.svelte';

type Editable = Partial<Pick<Task, 'title' | 'due_date' | 'priority' | 'notes' | 'is_project' | 'sort_order'>>;

/**
 * The user's tasks, kept current through PocketBase realtime. Changes are
 * applied only after the server confirms them, so the list never shows an
 * edit that wasn't saved.
 */
class TaskStore {
  tasks = $state<Task[]>([]);
  loaded = $state(false);
  /** Last error to show the user, if any. */
  error = $state('');

  #subscribed = false;
  #unsubscribe: (() => Promise<void>) | null = null;

  /**
   * Loads open tasks plus anything completed in the last two days (enough
   * to show tasks completed "today" in any time zone), and subscribes to
   * changes.
   */
  async load(): Promise<void> {
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString().replace('T', ' ');
    const list = await this.#call(() =>
      pb.collection('tasks').getFullList<Task>({
        filter: pb.filter("completed_at = '' || completed_at >= {:since}", { since }),
        batch: 500,
      }),
    );
    if (!list) return;
    this.tasks = list;
    this.loaded = true;

    if (!this.#subscribed) {
      this.#subscribed = true;
      this.#unsubscribe = await pb.collection('tasks').subscribe<Task>('*', (e) => {
        if (e.action === 'delete') this.#remove(e.record.id);
        else this.#upsert(e.record);
      });
    }
  }

  /** Clears the list and stops live updates (e.g. when leaving the screen). */
  async reset(): Promise<void> {
    this.#subscribed = false;
    // Removes only this store's listener; other screens may also listen to tasks.
    const unsubscribe = this.#unsubscribe;
    this.#unsubscribe = null;
    await unsubscribe?.().catch(() => {});
    this.tasks = [];
    this.loaded = false;
  }

  /** Quick-add: a Medium one-off due on `date`. */
  async add(title: string, date: IsoDate): Promise<boolean> {
    const created = await this.#call(() =>
      pb.collection('tasks').create<Task>({
        owner: pb.authStore.record?.id,
        title,
        type: 'one_off',
        priority: 'medium' satisfies Priority,
        due_date: date,
      }),
    );
    if (created) this.#upsert(created);
    return Boolean(created);
  }

  async update(id: string, changes: Editable): Promise<boolean> {
    const updated = await this.#call(() => pb.collection('tasks').update<Task>(id, changes));
    if (updated) this.#upsert(updated);
    return Boolean(updated);
  }

  async complete(id: string): Promise<boolean> {
    const result = await this.#call(() =>
      pb.send<{ task: Task; next: Task | null }>(`/api/tasks/${id}/complete`, { method: 'POST' }),
    );
    if (!result) return false;
    this.#upsert(result.task);
    if (result.next) this.#upsert(result.next);
    return true;
  }

  async uncomplete(id: string): Promise<boolean> {
    const successor = this.tasks.find((t) => t.id === id)?.next_instance;
    const result = await this.#call(() =>
      pb.send<{ task: Task }>(`/api/tasks/${id}/uncomplete`, { method: 'POST' }),
    );
    if (!result) return false;
    this.#upsert(result.task);
    if (successor) this.#remove(successor);
    return true;
  }

  /** Runs a request; on failure records the error (or flags the connection) and returns null. */
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

  #upsert(record: Task | RecordModel): void {
    const task = record as Task;
    const i = this.tasks.findIndex((t) => t.id === task.id);
    if (i === -1) this.tasks.push(task);
    else this.tasks[i] = task;
  }

  #remove(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }
}

export const taskStore = new TaskStore();
