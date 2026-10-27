// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../types';

type Listener = (e: { action: string; record: Partial<Task> }) => void;

const listeners: Record<string, Listener> = {};
const openTasks: Partial<Task>[] = [];

vi.mock('../pb', () => ({
  pb: {
    collection: (name: string) => ({
      getFullList: async () => (name === 'tasks' ? openTasks : [{ id: 'r1', title: 'Gym', deleted_at: '' }]),
      subscribe: async (_topic: string, listener: Listener) => {
        listeners[name] = listener;
        return async () => {};
      },
    }),
  },
}));

beforeEach(() => {
  vi.resetModules();
  openTasks.length = 0;
});

async function loadedStore() {
  const { ruleStore } = await import('./rules.svelte');
  await ruleStore.load();
  return ruleStore;
}

const taskEvent = (action: string, record: Partial<Task>) => listeners.tasks!({ action, record });

describe('ruleStore next due dates', () => {
  it('follows the open instance through completion', async () => {
    openTasks.push({ id: 't1', rule: 'r1', due_date: '2026-10-26' });
    const store = await loadedStore();
    expect(store.nextDue.r1).toBe('2026-10-26');

    // Completing: the instance closes, then the next one is created.
    taskEvent('update', { id: 't1', rule: 'r1', due_date: '2026-10-26', completed_at: '2026-10-26 18:00:00Z' });
    expect(store.nextDue.r1).toBeUndefined();
    taskEvent('create', { id: 't2', rule: 'r1', due_date: '2026-10-28', completed_at: '' });
    expect(store.nextDue.r1).toBe('2026-10-28');
  });

  it('ignores late events about a closed instance on the same date as the new one', async () => {
    // A Monday instance dragged to next Monday, then completed: the next
    // instance is due that same Monday.
    openTasks.push({ id: 't1', rule: 'r1', due_date: '2026-11-02' });
    const store = await loadedStore();

    taskEvent('update', { id: 't1', rule: 'r1', due_date: '2026-11-02', completed_at: '2026-10-26 18:00:00Z' });
    taskEvent('create', { id: 't2', rule: 'r1', due_date: '2026-11-02', completed_at: '' });
    // The server saves the completed task again to link its successor.
    taskEvent('update', { id: 't1', rule: 'r1', due_date: '2026-11-02', completed_at: '2026-10-26 18:00:00Z' });
    expect(store.nextDue.r1).toBe('2026-11-02');
  });

  it('clears the date when the open instance is deleted', async () => {
    openTasks.push({ id: 't1', rule: 'r1', due_date: '2026-10-26' });
    const store = await loadedStore();
    taskEvent('delete', { id: 't1', rule: 'r1', due_date: '2026-10-26', completed_at: '' });
    expect(store.nextDue.r1).toBeUndefined();
  });
});
