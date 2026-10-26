import { randomUUID } from 'node:crypto';
import PocketBase, { ClientResponseError, type RecordModel } from 'pocketbase';
import { inject } from 'vitest';
import { TIME_ZONE } from '../../src/lib/config';
import { todayIn } from '../../src/lib/recurrence';

export const url = inject('pbUrl');

export function client(): PocketBase {
  const pb = new PocketBase(url);
  pb.autoCancellation(false);
  return pb;
}

export async function superuser(): Promise<PocketBase> {
  const pb = client();
  const { email, password } = inject('superuser');
  await pb.collection('_superusers').authWithPassword(email, password);
  return pb;
}

export interface TestUser {
  pb: PocketBase;
  id: string;
}



/** Creates a fresh user (via the superuser) and returns a client logged in as them. */
export async function newUser(admin: PocketBase): Promise<TestUser> {
  const email = `user-${randomUUID()}@example.test`;
  const password = 'test-password-123';
  const record = await admin.collection('users').create({ email, password, passwordConfirm: password });
  const pb = client();
  await pb.collection('users').authWithPassword(email, password);
  return { pb, id: record.id };
}

export const today = (): string => todayIn(TIME_ZONE);

export function completeTask(pb: PocketBase, id: string) {
  return pb.send<{ task: RecordModel; next: RecordModel | null }>(`/api/tasks/${id}/complete`, {
    method: 'POST',
  });
}

export function uncompleteTask(pb: PocketBase, id: string) {
  return pb.send<{ task: RecordModel }>(`/api/tasks/${id}/uncomplete`, { method: 'POST' });
}

export function deleteRule(pb: PocketBase, id: string) {
  return pb.send(`/api/recurring-rules/${id}/delete`, { method: 'POST' });
}

/** All tasks created from a rule, oldest first. */
export function instancesOf(pb: PocketBase, ruleId: string) {
  return pb.collection('tasks').getFullList({ filter: pb.filter('rule = {:ruleId}', { ruleId }), sort: 'created' });
}

export function openInstancesOf(pb: PocketBase, ruleId: string) {
  return pb
    .collection('tasks')
    .getFullList({ filter: pb.filter("rule = {:ruleId} && completed_at = ''", { ruleId }) });
}

/** Resolves to the HTTP status of a failed request; fails the test if it succeeds. */
export async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ClientResponseError) return err.status;
    throw err;
  }
  throw new Error('Expected the request to fail, but it succeeded');
}
