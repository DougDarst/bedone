import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { addDays } from '../../src/lib/recurrence';
import { createTask, expect, row, signIn, test, today, type TestUser } from './fixtures';

/**
 * Automated accessibility checks (axe-core, WCAG 2.2 A and AA) on every
 * screen and dialog, in both themes. They catch contrast, labelling, and
 * ARIA mistakes; keyboard and screen-reader flows are covered by the other
 * specs.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoViolations(page: Page) {
  // Let transitions (checkbox, dialog) finish so colors are final.
  await page.waitForTimeout(300);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = violations.map((v) => ({
    rule: v.id,
    help: v.help,
    nodes: v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary?.split('\n').slice(1).join(' ')}`),
  }));
  expect(summary).toEqual([]);
}

/** One of each kind of row: overdue, project, recurring, each priority, completed, with notes. */
async function seedTasks(user: TestUser) {
  await createTask(user, { title: 'Overdue report', due_date: addDays(today(), -2), priority: 'high' });
  await createTask(user, { title: 'Garage project', is_project: true, priority: 'low', notes: '<p>Plan</p>' });
  await createTask(user, { title: 'Call the dentist' });
  const done = await createTask(user, { title: 'Pay rent' });
  await user.api.send(`/api/tasks/${done.id}/complete`, { method: 'POST' });
  await user.api
    .collection('recurring_rules')
    .create({ owner: user.id, title: 'Water plants', priority: 'medium', frequency: 'daily' });
  await user.api.collection('recurring_rules').create({
    owner: user.id,
    title: 'Pay bills',
    priority: 'high',
    frequency: 'monthly',
    month_week: '1',
    month_weekday: 'mon',
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test('sign-in screen', async ({ page, user }) => {
      await page.goto('/');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill('wrong password');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await expectNoViolations(page);
    });

    test('task list, menu, and notes', async ({ page, user }) => {
      await seedTasks(user);
      await signIn(page, user);
      await expect(row(page, 'Pay rent')).toBeVisible();
      await page.getByRole('button', { name: 'High', exact: true }).click(); // a pressed filter chip
      await page.getByRole('button', { name: 'High', exact: true }).click();
      await expectNoViolations(page);

      await page.getByRole('button', { name: 'Menu' }).click();
      await expectNoViolations(page);
      await page.keyboard.press('Escape');

      await row(page, 'Garage project').getByRole('button', { name: 'Open notes: Garage project' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);
    });

    test('recurring tasks screen and rule dialog', async ({ page, user }) => {
      await seedTasks(user);
      await signIn(page, user);
      await page.goto('/#/recurring');
      await expect(page.getByRole('button', { name: /^Water plants/ })).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('button', { name: /^Pay bills/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText(/Delete “Pay bills”\?/)).toBeVisible();
      await expectNoViolations(page);
      await page.getByRole('button', { name: 'Keep' }).click();
      await page.getByRole('button', { name: 'Cancel' }).click();

      await page.getByRole('button', { name: 'Add weekly task' }).click();
      await page.getByRole('button', { name: 'Save' }).click(); // shows the validation errors
      await expectNoViolations(page);
    });

    test('offline screen', async ({ page, user, context }) => {
      await signIn(page, user);
      await context.setOffline(true);
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoViolations(page);
      await context.setOffline(false);
    });
  });
}
