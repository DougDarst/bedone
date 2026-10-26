/// <reference path="../pb_data/types.d.ts" />

/**
 * Hooks and routes for tasks and recurring rules. The logic lives in
 * lib/service.js; each handler runs in its own JS context, so it must
 * `require` the service itself.
 *
 * Every write that touches more than one record runs in one transaction, so
 * a failure part-way leaves nothing half-done.
 */

// ---- Model hooks: run on every save, including the service's own writes ----

onRecordCreate((e) => {
  require(`${__hooks}/lib/service.js`).normalizeRule(e.record);
  e.next();
}, 'recurring_rules');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/service.js`).normalizeRule(e.record);
  e.next();
}, 'recurring_rules');

onRecordCreate((e) => {
  require(`${__hooks}/lib/service.js`).validateTask(e.record);
  // New tasks go to the bottom of their priority group.
  if (!e.record.getFloat('sort_order')) e.record.set('sort_order', Date.now());
  e.next();
}, 'tasks');

onRecordUpdate((e) => {
  require(`${__hooks}/lib/service.js`).validateTask(e.record);
  e.next();
}, 'tasks');

// ---- Request hooks: records API writes on recurring_rules ----

// Creating a rule also creates its first instance.
onRecordCreateRequest((e) => {
  const service = require(`${__hooks}/lib/service.js`);
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
    service.createFirstInstance(txApp, e.record);
  });
}, 'recurring_rules');

// Editing a rule updates its open instance.
onRecordUpdateRequest((e) => {
  const service = require(`${__hooks}/lib/service.js`);
  const before = service.ruleSnapshot(e.record.original());
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
    service.syncOpenInstance(txApp, e.record, before);
  });
}, 'recurring_rules');

// ---- Custom routes ----

routerAdd(
  'POST',
  '/api/tasks/{id}/complete',
  (e) => {
    const service = require(`${__hooks}/lib/service.js`);
    let task;
    let next = null;
    e.app.runInTransaction((txApp) => {
      task = service.findOwned(txApp, 'tasks', e.request.pathValue('id'), e.auth);
      next = service.completeTask(txApp, task);
    });
    return e.json(200, { task, next });
  },
  $apis.requireAuth('users'),
);

routerAdd(
  'POST',
  '/api/tasks/{id}/uncomplete',
  (e) => {
    const service = require(`${__hooks}/lib/service.js`);
    let task;
    e.app.runInTransaction((txApp) => {
      task = service.findOwned(txApp, 'tasks', e.request.pathValue('id'), e.auth);
      service.uncompleteTask(txApp, task);
    });
    return e.json(200, { task });
  },
  $apis.requireAuth('users'),
);

routerAdd(
  'POST',
  '/api/recurring-rules/{id}/delete',
  (e) => {
    const service = require(`${__hooks}/lib/service.js`);
    e.app.runInTransaction((txApp) => {
      service.deleteRule(txApp, service.findOwned(txApp, 'recurring_rules', e.request.pathValue('id'), e.auth));
    });
    return e.noContent(204);
  },
  $apis.requireAuth('users'),
);
