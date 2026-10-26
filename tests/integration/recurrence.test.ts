import type PocketBase from 'pocketbase';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, firstOccurrence, nextOccurrence, type RecurrenceRule } from '../../src/lib/recurrence';
import {
  completeTask,
  deleteRule,
  instancesOf,
  newUser,
  openInstancesOf,
  statusOf,
  superuser,
  today,
  uncompleteTask,
  type TestUser,
} from './helpers';

let admin: PocketBase;
let user: TestUser;

beforeAll(async () => {
  admin = await superuser();
  user = await newUser(admin);
});

function createRule(fields: Record<string, unknown>) {
  return user.pb.collection('recurring_rules').create({ owner: user.id, priority: 'medium', ...fields });
}

async function onlyOpenInstance(ruleId: string) {
  const open = await openInstancesOf(user.pb, ruleId);
  expect(open).toHaveLength(1);
  return open[0]!;
}

/** Superuser-only: puts an instance on an arbitrary scheduled date, as if created long ago. */
function backdate(taskId: string, date: string) {
  return admin.collection('tasks').update(taskId, { due_date: date, scheduled_date: date });
}

describe('creating a rule', () => {
  it('creates the first instance today for a daily rule', async () => {
    const rule = await createRule({ title: 'Morning stretch', frequency: 'daily', priority: 'high' });
    const instance = await onlyOpenInstance(rule.id);
    expect(instance).toMatchObject({
      title: 'Morning stretch',
      priority: 'high',
      type: 'daily',
      due_date: today(),
      scheduled_date: today(),
      is_project: false,
      owner: user.id,
    });
  });

  it('creates the first instance on the next matching date for weekly and monthly rules', async () => {
    const weekly = await createRule({ title: 'Gym', frequency: 'weekly', weekdays: ['tue', 'thu'] });
    expect((await onlyOpenInstance(weekly.id)).due_date).toBe(
      firstOccurrence({ frequency: 'weekly', weekdays: ['tue', 'thu'] }, today()),
    );

    const monthly = await createRule({
      title: 'Pay credit card',
      frequency: 'monthly',
      month_week: 'last',
      month_weekday: 'fri',
    });
    expect((await onlyOpenInstance(monthly.id)).due_date).toBe(
      firstOccurrence({ frequency: 'monthly', monthWeek: 'last', monthWeekday: 'fri' }, today()),
    );
  });

  it('stores weekdays in a fixed (Sunday-first) order', async () => {
    const rule = await createRule({ title: 'Ordered', frequency: 'weekly', weekdays: ['thu', 'tue', 'sun'] });
    expect(rule.weekdays).toEqual(['sun', 'tue', 'thu']);
  });

  it('clears schedule fields that do not apply to the frequency', async () => {
    const rule = await createRule({ title: 'Daily', frequency: 'daily', weekdays: ['mon'], month_week: '1' });
    expect(rule.weekdays).toEqual([]);
    expect(rule.month_week).toBe('');
  });

  it('rejects an invalid schedule and creates nothing', async () => {
    const before = await user.pb.collection('recurring_rules').getFullList();
    expect(await statusOf(createRule({ title: 'No days', frequency: 'weekly', weekdays: [] }))).toBe(400);
    expect(await statusOf(createRule({ title: 'No week', frequency: 'monthly', month_weekday: 'mon' }))).toBe(400);
    expect(await user.pb.collection('recurring_rules').getFullList()).toHaveLength(before.length);
  });
});

describe('completing an instance', () => {
  it('creates the next instance from the scheduled date and links it', async () => {
    const rule = await createRule({ title: 'Vitamins', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);

    const { task, next } = await completeTask(user.pb, first.id);
    expect(task.completed_at).not.toBe('');
    expect(next).not.toBeNull();
    expect(next!.due_date).toBe(addDays(first.scheduled_date, 1));
    expect(next!.scheduled_date).toBe(next!.due_date);
    expect(task.next_instance).toBe(next!.id);
    expect((await onlyOpenInstance(rule.id)).id).toBe(next!.id);
  });

  // In these cases, calculating from the moved due date would give a different
  // (wrong) answer, so they prove the scheduled date is what's used.
  it('ignores a manually moved due date (daily moved 3 days later → still the next day)', async () => {
    const rule = await createRule({ title: 'Read', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    await user.pb.collection('tasks').update(first.id, { due_date: addDays(first.due_date, 3) });

    const { next } = await completeTask(user.pb, first.id);
    expect(next!.due_date).toBe(addDays(first.scheduled_date, 1));
  });

  it('ignores a manually moved due date (Tue/Thu instance moved to its next slot)', async () => {
    const schedule: RecurrenceRule = { frequency: 'weekly', weekdays: ['tue', 'thu'] };
    const rule = await createRule({ title: 'Gym', frequency: 'weekly', weekdays: ['tue', 'thu'] });
    const first = await onlyOpenInstance(rule.id);
    const nextSlot = nextOccurrence(schedule, first.scheduled_date);
    await user.pb.collection('tasks').update(first.id, { due_date: nextSlot });

    const { next } = await completeTask(user.pb, first.id);
    expect(next!.due_date).toBe(nextSlot);
    expect(next!.due_date).not.toBe(nextOccurrence(schedule, nextSlot));
  });

  it('creates overdue catch-up instances one at a time', async () => {
    const rule = await createRule({ title: 'Journal', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    const threeDaysAgo = addDays(today(), -3);
    await backdate(first.id, threeDaysAgo);

    const { next } = await completeTask(user.pb, first.id);
    expect(next!.due_date).toBe(addDays(threeDaysAgo, 1));
    const { next: after } = await completeTask(user.pb, next!.id);
    expect(after!.due_date).toBe(addDays(threeDaysAgo, 2));
  });

  it('monthly: the next instance is the same pattern next month', async () => {
    const schedule: RecurrenceRule = { frequency: 'monthly', monthWeek: 2, monthWeekday: 'wed' };
    const rule = await createRule({ title: 'Book club', frequency: 'monthly', month_week: '2', month_weekday: 'wed' });
    const first = await onlyOpenInstance(rule.id);
    expect(first.due_date).toBe(firstOccurrence(schedule, today()));

    const { next } = await completeTask(user.pb, first.id);
    expect(next!.due_date).toBe(nextOccurrence(schedule, first.scheduled_date));
    expect(next!.due_date.slice(0, 7)).not.toBe(first.due_date.slice(0, 7));
  });

  it('two simultaneous completions (e.g. two devices) create only one next instance', async () => {
    const rule = await createRule({ title: 'Race', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);

    const results = await Promise.allSettled([completeTask(user.pb, first.id), completeTask(user.pb, first.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await instancesOf(user.pb, rule.id)).toHaveLength(2);
    expect(await openInstancesOf(user.pb, rule.id)).toHaveLength(1);
  });

  it('rejects completing twice', async () => {
    const rule = await createRule({ title: 'Twice', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    await completeTask(user.pb, first.id);
    expect(await statusOf(completeTask(user.pb, first.id))).toBe(400);
    expect(await instancesOf(user.pb, rule.id)).toHaveLength(2);
  });

  it('never creates instances for one-offs', async () => {
    const task = await user.pb
      .collection('tasks')
      .create({ owner: user.id, title: 'One-off', type: 'one_off', priority: 'low', due_date: today() });
    const { task: done, next } = await completeTask(user.pb, task.id);
    expect(next).toBeNull();
    expect(done.completed_at).not.toBe('');
  });
});

describe('reopening (uncompleting) an instance', () => {
  it('reopens it and deletes the successor it created', async () => {
    const rule = await createRule({ title: 'Undo me', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    const { next } = await completeTask(user.pb, first.id);

    const { task } = await uncompleteTask(user.pb, first.id);
    expect(task.completed_at).toBe('');
    expect(task.next_instance).toBe('');
    expect((await onlyOpenInstance(rule.id)).id).toBe(first.id);
    expect(await statusOf(user.pb.collection('tasks').getOne(next!.id))).toBe(404);
  });

  it('is blocked when the successor is already completed', async () => {
    const rule = await createRule({ title: 'Chain', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    const { next } = await completeTask(user.pb, first.id);
    const { next: third } = await completeTask(user.pb, next!.id);

    expect(await statusOf(uncompleteTask(user.pb, first.id))).toBe(400);
    expect((await user.pb.collection('tasks').getOne(first.id)).completed_at).not.toBe('');
    expect((await onlyOpenInstance(rule.id)).id).toBe(third!.id);
  });

  it('works for one-offs', async () => {
    const task = await user.pb
      .collection('tasks')
      .create({ owner: user.id, title: 'Reopen me', type: 'one_off', priority: 'low', due_date: today() });
    await completeTask(user.pb, task.id);
    expect((await uncompleteTask(user.pb, task.id)).task.completed_at).toBe('');
  });

  it('rejects reopening an open task', async () => {
    const rule = await createRule({ title: 'Open', frequency: 'daily' });
    expect(await statusOf(uncompleteTask(user.pb, (await onlyOpenInstance(rule.id)).id))).toBe(400);
  });
});

describe('editing a rule', () => {
  it('updates the open instance’s title and priority, not completed ones', async () => {
    const rule = await createRule({ title: 'Old title', frequency: 'daily', priority: 'low' });
    const first = await onlyOpenInstance(rule.id);
    const { next } = await completeTask(user.pb, first.id);

    await user.pb.collection('recurring_rules').update(rule.id, { title: 'New title', priority: 'high' });
    expect(await user.pb.collection('tasks').getOne(next!.id)).toMatchObject({ title: 'New title', priority: 'high' });
    expect(await user.pb.collection('tasks').getOne(first.id)).toMatchObject({ title: 'Old title', priority: 'low' });
  });

  it('moves an unmoved open instance to the new schedule’s first date', async () => {
    const rule = await createRule({ title: 'Reschedule', frequency: 'weekly', weekdays: ['mon'] });
    await user.pb.collection('recurring_rules').update(rule.id, { weekdays: ['thu'] });
    const expected = firstOccurrence({ frequency: 'weekly', weekdays: ['thu'] } as RecurrenceRule, today());
    expect(await onlyOpenInstance(rule.id)).toMatchObject({ due_date: expected, scheduled_date: expected });
  });

  it('moves an overdue (unmoved) instance forward to on or after today', async () => {
    const monday: RecurrenceRule = { frequency: 'weekly', weekdays: ['mon'] };
    const rule = await createRule({ title: 'Overdue reschedule', frequency: 'weekly', weekdays: ['mon'] });
    const first = await onlyOpenInstance(rule.id);
    const pastMonday = firstOccurrence(monday, addDays(today(), -14));
    await backdate(first.id, pastMonday);

    await user.pb.collection('recurring_rules').update(rule.id, { weekdays: ['thu'] });
    const expected = firstOccurrence({ frequency: 'weekly', weekdays: ['thu'] }, today());
    expect(await onlyOpenInstance(rule.id)).toMatchObject({ due_date: expected, scheduled_date: expected });
  });

  it('renaming or reprioritizing does not move an overdue instance (keeps the catch-up)', async () => {
    const rule = await createRule({ title: 'Catching up', frequency: 'daily', priority: 'low' });
    const first = await onlyOpenInstance(rule.id);
    const threeDaysAgo = addDays(today(), -3);
    await backdate(first.id, threeDaysAgo);

    await user.pb.collection('recurring_rules').update(rule.id, { title: 'Still catching up', priority: 'high' });
    expect(await onlyOpenInstance(rule.id)).toMatchObject({
      title: 'Still catching up',
      priority: 'high',
      due_date: threeDaysAgo,
      scheduled_date: threeDaysAgo,
    });
  });

  it('saving the same weekdays in a different order is not a schedule change', async () => {
    const schedule: RecurrenceRule = { frequency: 'weekly', weekdays: ['tue', 'thu'] };
    const rule = await createRule({ title: 'Same days', frequency: 'weekly', weekdays: ['tue', 'thu'] });
    const first = await onlyOpenInstance(rule.id);
    const pastSlot = firstOccurrence(schedule, addDays(today(), -14));
    await backdate(first.id, pastSlot);

    await user.pb.collection('recurring_rules').update(rule.id, { weekdays: ['thu', 'tue'] });
    expect(await onlyOpenInstance(rule.id)).toMatchObject({ due_date: pastSlot, scheduled_date: pastSlot });
  });

  it('leaves a manually moved instance where it is', async () => {
    const rule = await createRule({ title: 'Moved', frequency: 'weekly', weekdays: ['mon'] });
    const first = await onlyOpenInstance(rule.id);
    const movedTo = addDays(first.due_date, 2);
    await user.pb.collection('tasks').update(first.id, { due_date: movedTo });

    await user.pb.collection('recurring_rules').update(rule.id, { weekdays: ['thu'] });
    expect(await onlyOpenInstance(rule.id)).toMatchObject({ due_date: movedTo, scheduled_date: first.scheduled_date });
  });

  it('does not allow changing the frequency', async () => {
    const rule = await createRule({ title: 'Fixed', frequency: 'daily' });
    expect(
      await statusOf(user.pb.collection('recurring_rules').update(rule.id, { frequency: 'weekly', weekdays: ['mon'] })),
    ).toBe(404);
  });
});

describe('deleting a rule', () => {
  it('soft-deletes the rule, removes the open instance, and keeps completed ones', async () => {
    const rule = await createRule({ title: 'Delete me', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    const { next } = await completeTask(user.pb, first.id);

    await deleteRule(user.pb, rule.id);

    expect((await user.pb.collection('recurring_rules').getOne(rule.id)).deleted_at).not.toBe('');
    expect(await openInstancesOf(user.pb, rule.id)).toHaveLength(0);
    expect(await statusOf(user.pb.collection('tasks').getOne(next!.id))).toBe(404);
    const kept = await user.pb.collection('tasks').getOne(first.id);
    expect(kept.completed_at).not.toBe('');
    expect(kept.rule).toBe(rule.id);
  });

  it('cannot be edited, deleted again, or have instances reopened afterwards', async () => {
    const rule = await createRule({ title: 'Gone', frequency: 'daily' });
    const first = await onlyOpenInstance(rule.id);
    await completeTask(user.pb, first.id);
    await deleteRule(user.pb, rule.id);

    expect(await statusOf(user.pb.collection('recurring_rules').update(rule.id, { title: 'x' }))).toBe(404);
    expect(await statusOf(deleteRule(user.pb, rule.id))).toBe(404);
    expect(await statusOf(uncompleteTask(user.pb, first.id))).toBe(400);
  });
});

describe('task invariants', () => {
  it('rejects impossible dates', async () => {
    const create = user.pb
      .collection('tasks')
      .create({ owner: user.id, title: 'Bad date', type: 'one_off', priority: 'low', due_date: '2026-02-30' });
    expect(await statusOf(create)).toBe(400);
  });

  it('allows projects only on one-offs', async () => {
    const oneOff = await user.pb
      .collection('tasks')
      .create({ owner: user.id, title: 'Remodel', type: 'one_off', priority: 'low', due_date: today() });
    expect((await user.pb.collection('tasks').update(oneOff.id, { is_project: true })).is_project).toBe(true);

    const rule = await createRule({ title: 'Not a project', frequency: 'daily' });
    const instance = await onlyOpenInstance(rule.id);
    expect(await statusOf(user.pb.collection('tasks').update(instance.id, { is_project: true }))).toBe(400);
  });

  it('gives new tasks a sort order', async () => {
    const task = await user.pb
      .collection('tasks')
      .create({ owner: user.id, title: 'Sorted', type: 'one_off', priority: 'low', due_date: today() });
    expect(task.sort_order).toBeGreaterThan(0);
  });

  it('enforces one open instance per rule at the database level', async () => {
    const rule = await createRule({ title: 'Unique', frequency: 'daily' });
    const extra = admin.collection('tasks').create({
      owner: user.id,
      title: 'Duplicate',
      type: 'daily',
      rule: rule.id,
      priority: 'low',
      due_date: today(),
      scheduled_date: today(),
    });
    expect(await statusOf(extra)).toBe(400);
  });
});
