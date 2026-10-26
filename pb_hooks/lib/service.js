/// <reference path="../../pb_data/types.d.ts" />

/**
 * Server-side task and recurrence logic, shared by the hooks and routes in
 * ../tasks.pb.js. Every function that writes takes the transactional app
 * (`txApp`) so callers control the transaction. Date math lives in the
 * generated shared.cjs (built from src/lib/recurrence).
 *
 * See "Recurrence algorithm" in docs/SPEC.md.
 */
const shared = require(`${__hooks}/generated/shared.cjs`);

/** Today's date (YYYY-MM-DD) in the app's time zone. */
function today() {
  return new DateTime().time().in(new Timezone(shared.TIME_ZONE)).format('2006-01-02');
}

function toArray(goSlice) {
  const out = [];
  for (let i = 0; i < goSlice.length; i++) out.push(goSlice[i]);
  return out;
}

/** Converts a recurring_rules record into the shape the shared rule functions expect. */
function ruleFromRecord(rec) {
  const frequency = rec.getString('frequency');
  if (frequency === 'weekly') {
    return { frequency, weekdays: toArray(rec.getStringSlice('weekdays')) };
  }
  if (frequency === 'monthly') {
    const week = rec.getString('month_week');
    return {
      frequency,
      monthWeek: week === 'last' ? 'last' : Number(week),
      monthWeekday: rec.getString('month_weekday'),
    };
  }
  return { frequency };
}

function scheduleKey(rec) {
  return JSON.stringify(ruleFromRecord(rec));
}

/** Clears schedule fields that don't apply to the rule's frequency, then validates it. */
function normalizeRule(rec) {
  const frequency = rec.getString('frequency');
  if (frequency !== 'weekly') rec.set('weekdays', []);
  if (frequency !== 'monthly') {
    rec.set('month_week', '');
    rec.set('month_weekday', '');
  }
  try {
    shared.assertValidRule(ruleFromRecord(rec));
  } catch (err) {
    throw new BadRequestError(String(err.message || err));
  }
}

/** Enforces task invariants the API rules and field options can't express. */
function validateTask(rec) {
  if (!shared.isIsoDate(rec.getString('due_date'))) {
    throw new BadRequestError('Invalid due date.');
  }
  const scheduled = rec.getString('scheduled_date');
  if (scheduled && !shared.isIsoDate(scheduled)) {
    throw new BadRequestError('Invalid scheduled date.');
  }
  const isOneOff = rec.getString('type') === 'one_off';
  if (isOneOff === Boolean(rec.getString('rule'))) {
    throw new BadRequestError('Only recurring tasks have a rule.');
  }
  if (rec.getBool('is_project') && !isOneOff) {
    throw new BadRequestError('Only one-off tasks can be projects.');
  }
}

/** Returns the rule's open instance, or null. */
function findOpenInstance(txApp, ruleId) {
  const found = txApp.findRecordsByFilter(
    'tasks',
    "rule = {:rule} && completed_at = ''",
    '',
    1,
    0,
    { rule: ruleId },
  );
  return found.length ? found[0] : null;
}

function createInstance(txApp, rule, date) {
  const task = new Record(txApp.findCollectionByNameOrId('tasks'));
  task.set('owner', rule.getString('owner'));
  task.set('title', rule.getString('title'));
  task.set('priority', rule.getString('priority'));
  task.set('type', rule.getString('frequency'));
  task.set('rule', rule.id);
  task.set('due_date', date);
  task.set('scheduled_date', date);
  txApp.save(task);
  return task;
}

/** A new rule's first instance: the first matching date on or after today. */
function createFirstInstance(txApp, rule) {
  return createInstance(txApp, rule, shared.firstOccurrence(ruleFromRecord(rule), today()));
}

/**
 * Applies a rule edit to its open instance. Title and priority always follow
 * the rule. A schedule change moves the instance to the first matching date
 * on or after today, unless the instance was manually moved.
 */
function syncOpenInstance(txApp, rule, before) {
  const open = findOpenInstance(txApp, rule.id);
  if (!open) return;
  if (rule.getString('title') !== before.title) open.set('title', rule.getString('title'));
  if (rule.getString('priority') !== before.priority) open.set('priority', rule.getString('priority'));
  const moved = open.getString('due_date') !== open.getString('scheduled_date');
  if (scheduleKey(rule) !== before.schedule && !moved) {
    const date = shared.firstOccurrence(ruleFromRecord(rule), today());
    open.set('due_date', date);
    open.set('scheduled_date', date);
  }
  txApp.save(open);
}

/** Snapshot of the rule fields syncOpenInstance compares against. */
function ruleSnapshot(rule) {
  return {
    title: rule.getString('title'),
    priority: rule.getString('priority'),
    schedule: scheduleKey(rule),
  };
}

/**
 * Marks a task complete. For a recurring instance of an active rule, also
 * creates the next instance, calculated from the ORIGINAL scheduled date.
 * Returns the next instance, or null.
 */
function completeTask(txApp, task) {
  if (task.getString('completed_at')) throw new BadRequestError('Task is already completed.');
  task.set('completed_at', new DateTime());
  // Save first so the rule has no open instance when the next one is created.
  txApp.save(task);

  const ruleId = task.getString('rule');
  if (!ruleId) return null;
  const rule = txApp.findRecordById('recurring_rules', ruleId);
  if (rule.getString('deleted_at')) return null;

  const nextDate = shared.nextOccurrence(ruleFromRecord(rule), task.getString('scheduled_date'));
  const next = createInstance(txApp, rule, nextDate);
  task.set('next_instance', next.id);
  txApp.save(task);
  return next;
}

/**
 * Reopens a completed task. For a recurring instance, deletes the successor
 * its completion created; blocked if that successor is already completed or
 * the rule has been deleted.
 */
function uncompleteTask(txApp, task) {
  if (!task.getString('completed_at')) throw new BadRequestError('Task is not completed.');

  const ruleId = task.getString('rule');
  if (ruleId && txApp.findRecordById('recurring_rules', ruleId).getString('deleted_at')) {
    throw new BadRequestError("Can't reopen: its recurring task was deleted.");
  }
  const nextId = task.getString('next_instance');
  if (nextId) {
    const next = txApp.findRecordById('tasks', nextId);
    if (next.getString('completed_at')) {
      throw new BadRequestError("Can't reopen: the next instance is already completed.");
    }
    txApp.delete(next);
  }
  task.set('next_instance', '');
  task.set('completed_at', '');
  txApp.save(task);
}

/** Soft-deletes a rule and deletes its open instance. Completed instances are kept. */
function deleteRule(txApp, rule) {
  if (rule.getString('deleted_at')) throw new NotFoundError();
  rule.set('deleted_at', new DateTime());
  txApp.save(rule);
  const open = findOpenInstance(txApp, rule.id);
  if (open) txApp.delete(open);
}

/** Loads a record by id, returning 404 unless it belongs to the authenticated user. */
function findOwned(txApp, collection, id, auth) {
  let rec;
  try {
    rec = txApp.findRecordById(collection, id);
  } catch (_) {
    throw new NotFoundError();
  }
  if (!auth || rec.getString('owner') !== auth.id) throw new NotFoundError();
  return rec;
}

module.exports = {
  today,
  normalizeRule,
  validateTask,
  createFirstInstance,
  syncOpenInstance,
  ruleSnapshot,
  completeTask,
  uncompleteTask,
  deleteRule,
  findOwned,
};
