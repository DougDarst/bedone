import type { Page } from '@playwright/test';
import { formatWeekdayDate } from '../../src/lib/format';
import { firstOccurrence, type RecurrenceRule } from '../../src/lib/recurrence';
import { createTask, expect, row, section, signIn, test, today, type TestUser } from './fixtures';

const screen = (page: Page) => page.getByRole('main');
const ruleSection = (page: Page, name: 'Daily' | 'Weekly' | 'Monthly') =>
  page.getByRole('region', { name, exact: true });
const editor = (page: Page) => page.getByRole('dialog');

/** "Today" or "Tue, Oct 27", as the screen shows next due dates. */
const dueLabel = (date: string) => (date === today() ? 'Today' : formatWeekdayDate(date));

async function openRecurring(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Recurring tasks' }).click();
  await expect(page.getByRole('heading', { name: 'Recurring tasks' })).toBeVisible();
}

async function openTasks(page: Page) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(section(page, 'Today')).toBeVisible();
}

function createRule(user: TestUser, fields: Record<string, unknown>) {
  return user.api.collection('recurring_rules').create({ owner: user.id, priority: 'medium', ...fields });
}

test.describe('navigation', () => {
  test('the menu switches screens; reload and Back keep working', async ({ signedIn: page }) => {
    await openRecurring(page);
    await expect(page).toHaveURL(/#\/recurring$/);
    for (const name of ['Daily', 'Weekly', 'Monthly'] as const) {
      await expect(ruleSection(page, name)).toBeVisible();
    }
    await expect(ruleSection(page, 'Daily').getByText('No daily tasks yet')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Recurring tasks' })).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.getByRole('link', { name: 'Recurring tasks' })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Tasks', exact: true }).click();
    await expect(section(page, 'Today')).toBeVisible();

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Recurring tasks' })).toBeVisible();
  });
});

test.describe('creating', () => {
  test('a daily task appears in the list and on the task list', async ({ signedIn: page }) => {
    await openRecurring(page);
    await ruleSection(page, 'Daily').getByRole('button', { name: 'Add daily task' }).click();
    await editor(page).getByLabel('Title').fill('Morning stretch');
    await editor(page).getByRole('radio', { name: 'High' }).check();
    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(editor(page)).toHaveCount(0);

    const daily = ruleSection(page, 'Daily');
    await expect(daily.getByRole('button', { name: /Morning stretch/ })).toContainText('Every day');
    await expect(daily.getByRole('button', { name: /Morning stretch/ })).toContainText('Next: Today');

    await openTasks(page);
    const instance = row(section(page, 'Today'), 'Morning stretch');
    await expect(instance.getByRole('img', { name: 'Recurring' })).toBeVisible();
    await expect(instance.getByLabel('Priority')).toHaveValue('high');
  });

  test('a weekly task on chosen days', async ({ signedIn: page }) => {
    await openRecurring(page);
    await ruleSection(page, 'Weekly').getByRole('button', { name: 'Add weekly task' }).click();
    const dialog = editor(page);
    await dialog.getByLabel('Title').fill('Gym');
    // Start from no days selected (today's weekday is preselected).
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      await dialog.getByRole('checkbox', { name: day }).uncheck();
    }
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByText('Pick at least one day.')).toBeVisible();

    await dialog.getByRole('checkbox', { name: 'Thursday' }).check();
    await dialog.getByRole('checkbox', { name: 'Tuesday' }).check();
    const first = firstOccurrence({ frequency: 'weekly', weekdays: ['tue', 'thu'] }, today());
    await expect(dialog.getByText(/^Every Tue, Thu/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Save' }).click();

    const gym = ruleSection(page, 'Weekly').getByRole('button', { name: /Gym/ });
    await expect(gym).toContainText('Every Tue, Thu');
    await expect(gym).toContainText(`Next: ${dueLabel(first)}`);
  });

  test('a monthly task on the last Friday', async ({ signedIn: page }) => {
    await openRecurring(page);
    await ruleSection(page, 'Monthly').getByRole('button', { name: 'Add monthly task' }).click();
    const dialog = editor(page);
    await dialog.getByLabel('Title').fill('Pay credit card');
    await dialog.getByLabel('Week of the month').selectOption('last');
    await dialog.getByLabel('Day of the week').selectOption('fri');
    await dialog.getByRole('button', { name: 'Save' }).click();

    const rule: RecurrenceRule = { frequency: 'monthly', monthWeek: 'last', monthWeekday: 'fri' };
    const card = ruleSection(page, 'Monthly').getByRole('button', { name: /Pay credit card/ });
    await expect(card).toContainText('Last Friday of each month');
    await expect(card).toContainText(`Next: ${dueLabel(firstOccurrence(rule, today()))}`);
  });

  test('a title is required; Cancel discards', async ({ signedIn: page }) => {
    await openRecurring(page);
    await ruleSection(page, 'Daily').getByRole('button', { name: 'Add daily task' }).click();
    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(editor(page).getByText('Add a title.')).toBeVisible();

    await editor(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(ruleSection(page, 'Daily').getByText('No daily tasks yet')).toBeVisible();
  });
});

test.describe('editing', () => {
  test('title and priority changes reach the open task', async ({ signedIn: page, user }) => {
    await createRule(user, { title: 'Vitamins', frequency: 'daily', priority: 'low' });
    await openRecurring(page);

    await ruleSection(page, 'Daily').getByRole('button', { name: /Vitamins/ }).click();
    await expect(editor(page).getByRole('heading', { name: 'Edit daily task' })).toBeVisible();
    await editor(page).getByLabel('Title').fill('Take vitamins');
    await editor(page).getByRole('radio', { name: 'High' }).check();
    await editor(page).getByRole('button', { name: 'Save' }).click();
    await expect(ruleSection(page, 'Daily').getByRole('button', { name: /Take vitamins/ })).toBeVisible();

    await openTasks(page);
    await expect(row(section(page, 'Today'), 'Take vitamins').getByLabel('Priority')).toHaveValue('high');
  });

  test('changing the days moves the next one', async ({ signedIn: page, user }) => {
    await createRule(user, { title: 'Team notes', frequency: 'weekly', weekdays: ['mon'] });
    await openRecurring(page);

    await ruleSection(page, 'Weekly').getByRole('button', { name: /Team notes/ }).click();
    await editor(page).getByRole('checkbox', { name: 'Monday' }).uncheck();
    await editor(page).getByRole('checkbox', { name: 'Wednesday' }).check();
    await editor(page).getByRole('button', { name: 'Save' }).click();

    const next = firstOccurrence({ frequency: 'weekly', weekdays: ['wed'] }, today());
    const card = ruleSection(page, 'Weekly').getByRole('button', { name: /Team notes/ });
    await expect(card).toContainText('Every Wed');
    await expect(card).toContainText(`Next: ${dueLabel(next)}`);
  });

  test('shows when the open task is overdue', async ({ signedIn: page, user, admin }) => {
    const rule = await createRule(user, { title: 'Journal', frequency: 'daily' });
    const instance = await user.api.collection('tasks').getFirstListItem(`rule = "${rule.id}"`);
    await admin.collection('tasks').update(instance.id, { due_date: '2026-01-05', scheduled_date: '2026-01-05' });
    await openRecurring(page);

    await expect(ruleSection(page, 'Daily').getByRole('button', { name: /Journal/ })).toContainText(
      'Overdue: Mon, Jan 5',
    );
  });
});

test.describe('deleting', () => {
  test('asks first; deleting removes the open task and keeps completed ones', async ({
    signedIn: page,
    user,
  }) => {
    const rule = await createRule(user, { title: 'Water plants', frequency: 'daily' });
    const first = await user.api.collection('tasks').getFirstListItem(`rule = "${rule.id}"`);
    await user.api.send(`/api/tasks/${first.id}/complete`, { method: 'POST' });
    await createTask(user, { title: 'Unrelated task' });
    await openRecurring(page);

    await ruleSection(page, 'Daily').getByRole('button', { name: /Water plants/ }).click();
    await editor(page).getByRole('button', { name: 'Delete' }).click();
    await expect(editor(page).getByText(/Delete “Water plants”\?/)).toBeVisible();
    await editor(page).getByRole('button', { name: 'Keep' }).click();
    await expect(editor(page).getByRole('button', { name: 'Save' })).toBeVisible();

    await editor(page).getByRole('button', { name: 'Delete' }).click();
    await editor(page).getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(editor(page)).toHaveCount(0);
    await expect(ruleSection(page, 'Daily').getByText('No daily tasks yet')).toBeVisible();

    const remaining = await user.api.collection('tasks').getFullList({ filter: `rule = "${rule.id}"` });
    expect(remaining.map((t) => t.id)).toEqual([first.id]);

    // On the task list: today's completed instance is still shown, and no open one remains.
    await openTasks(page);
    await expect(page.getByRole('button', { name: 'Mark not done: Water plants' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete: Water plants' })).toHaveCount(0);
    await expect(row(page, 'Unrelated task')).toBeVisible();
  });
});

test('changes on another device show up live', async ({ page, user }) => {
  const subscribed = page.waitForResponse(
    (res) => res.url().includes('/api/realtime') && res.request().method() === 'POST',
  );
  await signIn(page, user);
  await openRecurring(page);
  await subscribed;
  await expect(screen(page).getByText('No weekly tasks yet')).toBeVisible();

  await createRule(user, { title: 'Added elsewhere', frequency: 'weekly', weekdays: ['fri'] });
  await expect(ruleSection(page, 'Weekly').getByRole('button', { name: /Added elsewhere/ })).toBeVisible();
});
