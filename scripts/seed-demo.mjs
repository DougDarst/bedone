#!/usr/bin/env node
/**
 * Fills a demo account with realistic household, family, and work tasks,
 * for screenshots. Everything goes through the normal API as that user, so
 * recurring instances, completions, and ownership work exactly as in the app.
 *
 * Usage (PocketBase must be running; create the demo user in the dashboard first):
 *   DEMO_EMAIL=demo@example.com DEMO_PASSWORD='…' npm run seed:demo
 *
 * Dates are relative to today, so run it right before taking screenshots.
 * It refuses to run if the account already has tasks; to start over, delete
 * the demo user in the dashboard and create it again.
 */
import PocketBase from 'pocketbase';

const URL = process.env.PB_URL ?? 'http://127.0.0.1:8090';
const { DEMO_EMAIL: email, DEMO_PASSWORD: password } = process.env;
const TIME_ZONE = 'America/Los_Angeles'; // matches TIME_ZONE in src/lib/config.ts

if (!email || !password) {
  console.error('Set DEMO_EMAIL and DEMO_PASSWORD to the demo user’s login.');
  process.exit(1);
}

/** Today's date (YYYY-MM-DD) in the app's time zone, plus `days`. */
function day(days = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ---- Notes (HTML, as the Tiptap editor saves it) ----

const checklist = (items) =>
  `<ul data-type="taskList">${items
    .map(([done, text]) => `<li data-type="taskItem" data-checked="${done}"><p>${text}</p></li>`)
    .join('')}</ul>`;
const bullets = (items) => `<ul>${items.map((text) => `<li><p>${text}</p></li>`).join('')}</ul>`;

const NOTES = {
  garage: `<p>Goal: park <strong>both</strong> cars inside before winter.</p>${checklist([
    [true, 'Sort donate / sell / trash piles'],
    [true, 'Drop donations at Goodwill'],
    [false, 'List bikes and old stroller online'],
    [false, 'Install wall shelving'],
    [false, 'Sweep and seal the floor'],
  ])}`,
  vacation: `<p>Thinking <em>late June</em>, one week. Kids vote for the beach.</p>${checklist([
    [true, 'Pick dates around swim camp'],
    [false, 'Compare rentals near the coast'],
    [false, 'Book flights'],
    [false, 'Ask the Parkers about watching the dog'],
  ])}<p>Budget notes in the family spreadsheet.</p>`,
  budget: `<p>Due to finance by end of week.</p><ol><li><p>Pull Q3 actuals</p></li><li><p>Headcount plan for Q1</p></li><li><p>Tooling renewals (check the vendor list)</p></li></ol><p>Template: <a href="https://example.com/q4-budget">Q4 budget template</a></p>`,
  permission: `<p>Science museum trip. Needs signature and <strong>$15</strong> in the envelope.</p>`,
  pediatrician: `<p>Annual checkup for both kids. Ask about:</p>${bullets([
    'Flu shots',
    'Sports physical form for soccer',
  ])}`,
  slides: `${checklist([
    [true, 'Outline'],
    [false, 'Roadmap slide'],
    [false, 'Metrics from the dashboard'],
    [false, 'Dry run with Priya'],
  ])}`,
  groceries: `${checklist([
    [false, 'Milk, eggs, bread'],
    [false, 'Apples and bananas'],
    [false, 'Chicken thighs'],
    [false, 'Taco night stuff'],
    [true, 'Coffee'],
  ])}`,
  plumber: `<p>Kitchen faucet dripping again. Try <a href="https://example.com/plumber">Reliable Plumbing</a> first; they did the water heater.</p>`,
};

// ---- Recurring rules: their first instances are created on or after today ----

const RULES = [
  { title: 'Walk the dog', priority: 'high', frequency: 'daily', completeToday: true },
  { title: 'Take vitamins', priority: 'low', frequency: 'daily', completeToday: true },
  { title: 'Check kids’ homework folders', priority: 'medium', frequency: 'daily' },
  { title: 'Unload the dishwasher', priority: 'low', frequency: 'daily' },
  { title: 'Workout', priority: 'medium', frequency: 'weekly', weekdays: ['mon', 'wed', 'fri'] },
  { title: 'Soccer practice pickup', priority: 'high', frequency: 'weekly', weekdays: ['tue', 'thu'] },
  { title: 'Take out trash and recycling', priority: 'medium', frequency: 'weekly', weekdays: ['sun'] },
  { title: 'Meal plan and grocery list', priority: 'medium', frequency: 'weekly', weekdays: ['sat'] },
  { title: 'Water the plants', priority: 'low', frequency: 'weekly', weekdays: ['wed', 'sat'] },
  { title: '1:1 with my manager', priority: 'high', frequency: 'weekly', weekdays: ['mon'] },
  { title: 'Team status report', priority: 'medium', frequency: 'weekly', weekdays: ['fri'] },
  { title: 'Pay the mortgage', priority: 'high', frequency: 'monthly', month_week: '1', month_weekday: 'fri' },
  { title: 'Review the family budget', priority: 'medium', frequency: 'monthly', month_week: '1', month_weekday: 'sun' },
  { title: 'Book club', priority: 'low', frequency: 'monthly', month_week: '2', month_weekday: 'thu' },
  { title: 'Replace the HVAC filter', priority: 'low', frequency: 'monthly', month_week: 'last', month_weekday: 'sat' },
];

// ---- One-off tasks, by days from today (negative = overdue) ----

const TASKS = [
  { due: -3, title: 'Submit expense report', priority: 'high' },
  { due: -2, title: 'Return library books', priority: 'medium' },
  { due: -1, title: 'RSVP to Emma’s birthday party', priority: 'high' },

  { due: 0, title: 'Sign the field trip permission slip', priority: 'high', notes: NOTES.permission },
  { due: 0, title: 'Prep slides for quarterly planning', priority: 'high', notes: NOTES.slides },
  { due: 0, title: 'Call the pediatrician to book checkups', priority: 'medium', notes: NOTES.pediatrician },
  { due: 0, title: 'Order a birthday gift for Mom', priority: 'medium' },
  { due: 0, title: 'Schedule the plumber', priority: 'low', notes: NOTES.plumber },
  { due: 0, title: 'Reply to Sarah about carpool', priority: 'medium', done: true },
  { due: 0, title: 'Pay the water bill', priority: 'low', done: true },

  { due: 1, title: 'Dentist appointment at 3:30', priority: 'high' },
  { due: 1, title: 'Pick up dry cleaning', priority: 'low' },
  { due: 1, title: 'Grocery run', priority: 'medium', notes: NOTES.groceries },
  { due: 2, title: 'Q4 budget proposal', priority: 'high', project: true, notes: NOTES.budget },
  { due: 2, title: 'Renew car registration', priority: 'medium' },
  { due: 3, title: 'Parent-teacher conference', priority: 'high' },
  { due: 4, title: 'Garage clean-out', priority: 'low', project: true, notes: NOTES.garage },
  { due: 5, title: 'Get quotes for gutter cleaning', priority: 'low' },
  { due: 6, title: 'Plan summer vacation', priority: 'medium', project: true, notes: NOTES.vacation },
  { due: 6, title: 'Update résumé', priority: 'low' },
  { due: 12, title: 'Annual physical', priority: 'medium' },
  { due: 21, title: 'Renew the kids’ passports', priority: 'medium' },
];

const pb = new PocketBase(URL);
pb.autoCancellation(false);

try {
  await pb.collection('users').authWithPassword(email, password);
} catch (err) {
  console.error(`Couldn’t sign in as ${email} at ${URL}: ${err.message}`);
  process.exit(1);
}
const owner = pb.authStore.record.id;

const existing = await pb.collection('tasks').getList(1, 1);
if (existing.totalItems > 0) {
  console.error(`${email} already has tasks. Delete and recreate the user in the dashboard to start over.`);
  process.exit(1);
}

const complete = (id) => pb.send(`/api/tasks/${id}/complete`, { method: 'POST' });

// Created one at a time, so the manual order within each day matches the lists above.
for (const { completeToday, ...rule } of RULES) {
  const created = await pb.collection('recurring_rules').create({ owner, ...rule });
  if (completeToday) {
    const [instance] = await pb.collection('tasks').getFullList({
      filter: pb.filter("rule = {:rule} && completed_at = ''", { rule: created.id }),
    });
    if (instance?.due_date === day(0)) await complete(instance.id);
  }
}

for (const task of TASKS) {
  const created = await pb.collection('tasks').create({
    owner,
    type: 'one_off',
    title: task.title,
    priority: task.priority,
    due_date: day(task.due),
    is_project: Boolean(task.project),
    notes: task.notes ?? '',
  });
  if (task.done) await complete(created.id);
}

console.log(`Added ${RULES.length} recurring tasks and ${TASKS.length} one-off tasks for ${email}.`);
