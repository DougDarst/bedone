/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema: recurring_rules and tasks, owner-only API rules, and public
 * sign-up disabled. See "Design decisions › Data model" in docs/SPEC.md.
 *
 * Writes that involve recurrence (completing, reopening, deleting a rule) are
 * not allowed through the records API; they go through the custom routes in
 * pb_hooks/tasks.pb.js so they run in a single transaction.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');
    users.createRule = null; // only superusers can create accounts
    app.save(users);

    const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const PRIORITIES = ['high', 'medium', 'low'];
    const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
    const timestamps = [
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ];

    const rules = new Collection({
      type: 'base',
      name: 'recurring_rules',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      createRule:
        '@request.auth.id != "" && @request.body.owner = @request.auth.id && @request.body.deleted_at:isset = false',
      updateRule:
        'owner = @request.auth.id && deleted_at = "" && @request.body.owner:isset = false && ' +
        '@request.body.frequency:isset = false && @request.body.deleted_at:isset = false',
      deleteRule: null, // soft delete via POST /api/recurring-rules/{id}/delete
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: users.id, maxSelect: 1 },
        { name: 'title', type: 'text', required: true, max: 500 },
        { name: 'priority', type: 'select', required: true, maxSelect: 1, values: PRIORITIES },
        { name: 'frequency', type: 'select', required: true, maxSelect: 1, values: ['daily', 'weekly', 'monthly'] },
        { name: 'weekdays', type: 'select', maxSelect: 7, values: WEEKDAYS },
        { name: 'month_week', type: 'select', maxSelect: 1, values: ['1', '2', '3', '4', 'last'] },
        { name: 'month_weekday', type: 'select', maxSelect: 1, values: WEEKDAYS },
        { name: 'deleted_at', type: 'date' },
        ...timestamps,
      ],
      indexes: ['CREATE INDEX idx_recurring_rules_owner ON recurring_rules (owner)'],
    });
    app.save(rules);

    const tasks = new Collection({
      type: 'base',
      name: 'tasks',
      listRule: 'owner = @request.auth.id',
      viewRule: 'owner = @request.auth.id',
      // Clients create one-offs only; recurring instances are created by hooks.
      createRule:
        '@request.auth.id != "" && @request.body.owner = @request.auth.id && @request.body.type = "one_off" && ' +
        '@request.body.rule:isset = false && @request.body.scheduled_date:isset = false && ' +
        '@request.body.completed_at:isset = false && @request.body.next_instance:isset = false',
      // Completion goes through POST /api/tasks/{id}/complete and /uncomplete.
      // Completed tasks cannot be re-dated.
      updateRule:
        'owner = @request.auth.id && @request.body.owner:isset = false && @request.body.type:isset = false && ' +
        '@request.body.rule:isset = false && @request.body.scheduled_date:isset = false && ' +
        '@request.body.completed_at:isset = false && @request.body.next_instance:isset = false && ' +
        '(completed_at = "" || @request.body.due_date:isset = false)',
      deleteRule: null, // tasks are never deleted from the UI
      fields: [
        { name: 'owner', type: 'relation', required: true, collectionId: users.id, maxSelect: 1 },
        { name: 'title', type: 'text', required: true, max: 500 },
        { name: 'due_date', type: 'text', required: true, pattern: DATE_PATTERN },
        // Recurring instances only: the date the rule produced. Never changes when moved.
        { name: 'scheduled_date', type: 'text', pattern: DATE_PATTERN },
        { name: 'priority', type: 'select', required: true, maxSelect: 1, values: PRIORITIES },
        { name: 'notes', type: 'editor' },
        { name: 'type', type: 'select', required: true, maxSelect: 1, values: ['daily', 'weekly', 'monthly', 'one_off'] },
        { name: 'rule', type: 'relation', collectionId: rules.id, maxSelect: 1 },
        { name: 'is_project', type: 'bool' },
        { name: 'completed_at', type: 'date' },
        { name: 'sort_order', type: 'number' },
        ...timestamps,
      ],
      indexes: [
        'CREATE INDEX idx_tasks_owner_due_date ON tasks (owner, due_date)',
        // A rule can never have two open instances.
        "CREATE UNIQUE INDEX idx_tasks_one_open_per_rule ON tasks (rule) WHERE completed_at = '' AND rule != ''",
      ],
    });
    app.save(tasks);

    // Self-relation: the instance created when this one was completed, so
    // reopening it can remove exactly that successor.
    tasks.fields.add(new RelationField({ name: 'next_instance', collectionId: tasks.id, maxSelect: 1 }));
    app.save(tasks);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('tasks'));
    app.delete(app.findCollectionByNameOrId('recurring_rules'));
    const users = app.findCollectionByNameOrId('users');
    users.createRule = '';
    app.save(users);
  },
);
