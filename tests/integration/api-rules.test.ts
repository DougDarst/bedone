import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  client,
  completeTask,
  deleteRule,
  newUser,
  openInstancesOf,
  statusOf,
  superuser,
  today,
  uncompleteTask,
  type TestUser,
} from './helpers';

let admin: PocketBase;
let alice: TestUser;
let bob: TestUser;
let aliceTask: RecordModel;
let aliceRule: RecordModel;
let aliceInstance: RecordModel;

beforeAll(async () => {
  admin = await superuser();
  alice = await newUser(admin);
  bob = await newUser(admin);
  aliceTask = await alice.pb
    .collection('tasks')
    .create({ owner: alice.id, title: 'Alice task', type: 'one_off', priority: 'high', due_date: today() });
  aliceRule = await alice.pb
    .collection('recurring_rules')
    .create({ owner: alice.id, title: 'Alice rule', priority: 'low', frequency: 'daily' });
  aliceInstance = (await openInstancesOf(alice.pb, aliceRule.id))[0]!;
});

describe('unauthenticated requests', () => {
  const guest = () => client();

  it('see no tasks or rules', async () => {
    expect((await guest().collection('tasks').getList()).items).toEqual([]);
    expect((await guest().collection('recurring_rules').getList()).items).toEqual([]);
    expect(await statusOf(guest().collection('tasks').getOne(aliceTask.id))).toBe(404);
    expect(await statusOf(guest().collection('recurring_rules').getOne(aliceRule.id))).toBe(404);
  });

  it('cannot create, update, or complete anything', async () => {
    const create = guest()
      .collection('tasks')
      .create({ owner: alice.id, title: 'x', type: 'one_off', priority: 'low', due_date: today() });
    expect(await statusOf(create)).toBeGreaterThanOrEqual(400);
    expect(await statusOf(guest().collection('tasks').update(aliceTask.id, { title: 'x' }))).toBe(404);
    expect(await statusOf(completeTask(guest(), aliceTask.id))).toBe(401);
    expect(await statusOf(uncompleteTask(guest(), aliceTask.id))).toBe(401);
    expect(await statusOf(deleteRule(guest(), aliceRule.id))).toBe(401);
  });

  it('cannot sign up', async () => {
    const signUp = guest()
      .collection('users')
      .create({ email: 'new@example.test', password: 'password-123', passwordConfirm: 'password-123' });
    expect(await statusOf(signUp)).toBe(403);
  });
});

describe("another user's records", () => {
  it('are invisible', async () => {
    const tasks = await bob.pb.collection('tasks').getFullList();
    expect(tasks.find((t) => t.owner === alice.id)).toBeUndefined();
    expect(await bob.pb.collection('recurring_rules').getFullList()).toEqual([]);
    expect(await statusOf(bob.pb.collection('tasks').getOne(aliceTask.id))).toBe(404);
    expect(await statusOf(bob.pb.collection('recurring_rules').getOne(aliceRule.id))).toBe(404);
  });

  it('cannot be changed', async () => {
    expect(await statusOf(bob.pb.collection('tasks').update(aliceTask.id, { title: 'Hacked' }))).toBe(404);
    expect(await statusOf(bob.pb.collection('recurring_rules').update(aliceRule.id, { title: 'Hacked' }))).toBe(404);
    expect(await statusOf(completeTask(bob.pb, aliceInstance.id))).toBe(404);
    expect(await statusOf(uncompleteTask(bob.pb, aliceTask.id))).toBe(404);
    expect(await statusOf(deleteRule(bob.pb, aliceRule.id))).toBe(404);
    expect((await alice.pb.collection('tasks').getOne(aliceTask.id)).title).toBe('Alice task');
  });

  it('cannot be created on their behalf', async () => {
    const task = bob.pb
      .collection('tasks')
      .create({ owner: alice.id, title: 'x', type: 'one_off', priority: 'low', due_date: today() });
    const rule = bob.pb
      .collection('recurring_rules')
      .create({ owner: alice.id, title: 'x', priority: 'low', frequency: 'daily' });
    expect(await statusOf(task)).toBe(400);
    expect(await statusOf(rule)).toBe(400);
  });

  it('cannot be taken over by changing the owner', async () => {
    const steal = bob.pb.collection('tasks').update(aliceTask.id, { owner: bob.id });
    expect(await statusOf(steal)).toBe(404);
    const give = alice.pb.collection('tasks').update(aliceTask.id, { owner: bob.id });
    expect(await statusOf(give)).toBe(404);
  });
});

describe('fields only the server may set', () => {
  it('cannot be set when creating a task', async () => {
    const base = { owner: alice.id, title: 'x', priority: 'low', due_date: today() };
    const tasks = alice.pb.collection('tasks');
    expect(await statusOf(tasks.create({ ...base, type: 'daily' }))).toBe(400);
    expect(await statusOf(tasks.create({ ...base, type: 'one_off', rule: aliceRule.id }))).toBe(400);
    expect(await statusOf(tasks.create({ ...base, type: 'one_off', scheduled_date: today() }))).toBe(400);
    expect(await statusOf(tasks.create({ ...base, type: 'one_off', completed_at: new Date().toISOString() }))).toBe(400);
  });

  it('cannot be changed on a task', async () => {
    const tasks = alice.pb.collection('tasks');
    for (const change of [
      { completed_at: new Date().toISOString() },
      { type: 'weekly' },
      { rule: aliceRule.id },
      { scheduled_date: today() },
      { next_instance: aliceTask.id },
    ]) {
      expect(await statusOf(tasks.update(aliceInstance.id, change))).toBe(404);
    }
  });

  it('cannot be set on a rule', async () => {
    const rules = alice.pb.collection('recurring_rules');
    const create = rules.create({
      owner: alice.id,
      title: 'x',
      priority: 'low',
      frequency: 'daily',
      deleted_at: new Date().toISOString(),
    });
    expect(await statusOf(create)).toBe(400);
    expect(await statusOf(rules.update(aliceRule.id, { deleted_at: new Date().toISOString() }))).toBe(404);
  });

  it('does not allow re-dating a completed task', async () => {
    const task = await alice.pb
      .collection('tasks')
      .create({ owner: alice.id, title: 'Done', type: 'one_off', priority: 'low', due_date: today() });
    await completeTask(alice.pb, task.id);
    expect(await statusOf(alice.pb.collection('tasks').update(task.id, { due_date: '2030-01-01' }))).toBe(404);
  });
});

describe('deleting through the records API', () => {
  it('is not allowed for tasks or rules', async () => {
    expect(await statusOf(alice.pb.collection('tasks').delete(aliceTask.id))).toBe(403);
    expect(await statusOf(alice.pb.collection('recurring_rules').delete(aliceRule.id))).toBe(403);
  });
});

describe('the owner', () => {
  it('can read and edit their own records', async () => {
    const updated = await alice.pb.collection('tasks').update(aliceTask.id, { title: 'Renamed', notes: '<p>Hi</p>' });
    expect(updated).toMatchObject({ title: 'Renamed', notes: '<p>Hi</p>' });
    expect((await alice.pb.collection('recurring_rules').getOne(aliceRule.id)).title).toBe('Alice rule');
  });
});
