import { appDisplayName } from '../../src/lib/config';
import { formatWeekdayDate } from '../../src/lib/format';
import { addDays, nextOccurrence } from '../../src/lib/recurrence';
import { createTask, expect, row, section, signIn, test, titlesIn, today } from './fixtures';

const tomorrowHeading = () => formatWeekdayDate(addDays(today(), 1));

test.describe('signing in', () => {
  test('rejects a wrong password, then signs in and out', async ({ page, user }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(appDisplayName());
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('don’t match');

    await signIn(page, user);
    await expect(page.getByRole('heading', { level: 1, name: appDisplayName() })).toBeVisible();

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('stays signed in after a reload', async ({ signedIn: page }) => {
    await page.reload();
    await expect(section(page, 'Today')).toBeVisible();
  });
});

test.describe('task list', () => {
  test('always shows today and the next 7 days, with empty days marked', async ({ signedIn: page }) => {
    await expect(section(page, 'Today')).toBeVisible();
    for (let i = 1; i <= 7; i++) {
      await expect(section(page, formatWeekdayDate(addDays(today(), i)))).toBeVisible();
    }
    await expect(section(page, tomorrowHeading()).getByText('Nothing planned')).toBeVisible();
  });

  test('quick-add creates a Medium task for today', async ({ signedIn: page }) => {
    const input = page.getByPlaceholder('Add a task for today');
    await input.fill('Pick up dry cleaning');
    await input.press('Enter');

    const added = row(section(page, 'Today'), 'Pick up dry cleaning');
    await expect(added).toBeVisible();
    await expect(added.getByLabel('Priority')).toHaveValue('medium');
    await expect(input).toHaveValue('');
  });

  test('shows overdue tasks in their own date section, in red', async ({ signedIn: page, user }) => {
    const past = addDays(today(), -4);
    await createTask(user, { title: 'Renew registration', due_date: past });
    await page.reload();

    const overdue = section(page, formatWeekdayDate(past));
    await expect(overdue.getByText('Overdue')).toBeVisible();
    await expect(row(overdue, 'Renew registration').getByRole('textbox', { name: 'Title' })).toHaveCSS(
      'color',
      'rgb(194, 53, 43)', // --overdue (light theme)
    );
  });

  test('sorts by priority and shows project and recurring icons', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Low one', priority: 'low' });
    await createTask(user, { title: 'High project', priority: 'high', is_project: true });
    await user.api
      .collection('recurring_rules')
      .create({ owner: user.id, title: 'Daily stretch', priority: 'medium', frequency: 'daily' });
    await page.reload();

    const todaySection = section(page, 'Today');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['High project', 'Daily stretch', 'Low one']);
    await expect(row(todaySection, 'High project').getByRole('img', { name: 'Project' })).toBeVisible();
    await expect(row(todaySection, 'Daily stretch').getByRole('img', { name: 'Recurring' })).toBeVisible();
    await expect(row(todaySection, 'Low one').getByRole('img')).toHaveCount(0);
  });
});

test.describe('completing tasks', () => {
  test('completes and reopens a one-off', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Water plants' });
    await createTask(user, { title: 'Stays open', priority: 'low' });
    await page.reload();
    const todaySection = section(page, 'Today');

    await page.getByRole('button', { name: 'Complete: Water plants' }).click();
    const done = row(todaySection, 'Water plants');
    await expect(done.getByRole('textbox', { name: 'Title' })).toHaveCSS('text-decoration-line', 'line-through');
    // Completed tasks move to the bottom of their day.
    await expect.poll(() => titlesIn(todaySection)).toEqual(['Stays open', 'Water plants']);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Mark not done: Water plants' })).toBeVisible();

    await page.getByRole('button', { name: 'Mark not done: Water plants' }).click();
    await expect(page.getByRole('button', { name: 'Complete: Water plants' })).toBeVisible();
    await expect.poll(() => titlesIn(todaySection)).toEqual(['Water plants', 'Stays open']);
  });

  test('completing a recurring task creates the next instance', async ({ signedIn: page, user }) => {
    await user.api
      .collection('recurring_rules')
      .create({ owner: user.id, title: 'Take vitamins', priority: 'medium', frequency: 'daily' });
    await page.reload();

    await page.getByRole('button', { name: 'Complete: Take vitamins' }).click();
    await expect(row(section(page, tomorrowHeading()), 'Take vitamins')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark not done: Take vitamins' })).toBeVisible();

    // Reopening removes the instance it created.
    await page.getByRole('button', { name: 'Mark not done: Take vitamins' }).click();
    await expect(section(page, tomorrowHeading()).getByText('Nothing planned')).toBeVisible();
  });

  test('a weekly task’s next instance lands on its next scheduled day', async ({ signedIn: page, user }) => {
    const weekdays = ['tue', 'thu'] as const;
    await user.api
      .collection('recurring_rules')
      .create({ owner: user.id, title: 'Gym', priority: 'medium', frequency: 'weekly', weekdays });
    await page.reload();
    const first = await user.api.collection('tasks').getFirstListItem(`title = "Gym"`);

    await page.getByRole('button', { name: 'Complete: Gym' }).click();
    const next = nextOccurrence({ frequency: 'weekly', weekdays: [...weekdays] }, first.scheduled_date);
    await expect(row(section(page, formatWeekdayDate(next)), 'Gym')).toBeVisible();
  });
});

test.describe('editing tasks', () => {
  test('edits a title inline', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Draft budget' });
    await page.reload();

    const title = row(page, 'Draft budget').getByRole('textbox', { name: 'Title' });
    await title.click();
    await title.fill('Draft Q4 budget');
    await title.press('Enter');
    await expect(page.getByRole('button', { name: 'Complete: Draft Q4 budget' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Complete: Draft Q4 budget' })).toBeVisible();
  });

  test('changing the due date moves the task to that date', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Book flights' });
    await page.reload();

    const target = addDays(today(), 2);
    await row(page, 'Book flights').getByLabel('Due date').fill(target);
    await expect(row(section(page, formatWeekdayDate(target)), 'Book flights')).toBeVisible();
    await expect(row(section(page, 'Today'), 'Book flights')).toHaveCount(0);
  });

  test('a date beyond the next 7 days gets its own section', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Renew passport' });
    await page.reload();

    const later = addDays(today(), 19);
    await row(page, 'Renew passport').getByLabel('Due date').fill(later);
    await expect(row(section(page, formatWeekdayDate(later)), 'Renew passport')).toBeVisible();
  });

  test('changing priority re-sorts the day', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'First', priority: 'medium' });
    await createTask(user, { title: 'Second', priority: 'medium' });
    await page.reload();
    const todaySection = section(page, 'Today');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['First', 'Second']);

    await row(todaySection, 'Second').getByLabel('Priority').selectOption('high');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['Second', 'First']);
  });
});

test.describe('filters', () => {
  test('filter by date scope and priority, remembered after reload', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Today high', priority: 'high' });
    await createTask(user, { title: 'Today low', priority: 'low' });
    await createTask(user, { title: 'Far away', due_date: addDays(today(), 30) });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Complete: Far away' })).toBeVisible();

    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete: Far away' })).toHaveCount(0);
    await expect(section(page, tomorrowHeading())).toHaveCount(0);

    await page.getByRole('button', { name: 'High', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete: Today low' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Complete: Today high' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Complete: Today low' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'High', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByRole('button', { name: 'High', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Complete: Far away' })).toBeVisible();
  });
});

test.describe('theme', () => {
  test('the menu toggle overrides the system theme and is remembered', async ({ signedIn: page }) => {
    const html = page.locator('html');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(26, 25, 23)');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'System' }).click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
  });
});

test.describe('offline', () => {
  test('blocks the app while offline and recovers', async ({ signedIn: page, context }) => {
    await context.setOffline(true);
    const screen = page.getByRole('alertdialog', { name: /Can’t reach/ });
    await expect(screen).toBeVisible();
    // The app behind the screen is inert: nothing in it can be focused or edited.
    const quickAdd = page.getByPlaceholder('Add a task for today');
    const canFocus = () =>
      quickAdd.evaluate((el) => {
        (el as HTMLElement).focus();
        return document.activeElement === el;
      });
    expect(await canFocus()).toBe(false);

    // Recovers by itself when the connection comes back.
    await context.setOffline(false);
    await expect(screen).toHaveCount(0);
    expect(await canFocus()).toBe(true);
  });

  test('stays blocked while the server is unreachable; "Try again" recovers', async ({
    signedIn: page,
    context,
  }) => {
    // Network is back, but the server isn't answering yet.
    await page.route('**/api/health', (route) => route.abort());
    await context.setOffline(true);
    await context.setOffline(false);
    const screen = page.getByRole('alertdialog', { name: /Can’t reach/ });
    await expect(screen).toBeVisible();

    await page.unroute('**/api/health');
    await screen.getByRole('button', { name: 'Try again' }).click();
    await expect(screen).toHaveCount(0);
  });
});
