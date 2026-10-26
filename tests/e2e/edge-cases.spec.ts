import { TIME_ZONE } from '../../src/lib/config';
import { formatWeekdayDate } from '../../src/lib/format';
import { addDays, todayIn } from '../../src/lib/recurrence';
import { createTask, expect, row, section, signIn, test, titlesIn, today } from './fixtures';

/** The instant the next day starts in the app's time zone (handles PST/PDT). */
function nextMidnight(now: Date): Date {
  const current = todayIn(TIME_ZONE, now);
  const tomorrow = addDays(current, 1);
  for (const offset of ['-07:00', '-08:00']) {
    const candidate = new Date(`${tomorrow}T00:00:00${offset}`);
    const before = new Date(candidate.getTime() - 1);
    if (todayIn(TIME_ZONE, candidate) === tomorrow && todayIn(TIME_ZONE, before) === current) return candidate;
  }
  throw new Error(`Could not find midnight after ${now.toISOString()}`);
}

test.describe('midnight', () => {
  test('completed tasks disappear and "Today" moves on at midnight', async ({ page, user }) => {
    const now = new Date();
    await page.clock.install({ time: now });
    await createTask(user, { title: 'Done today' });
    await createTask(user, { title: 'Still open' });
    await signIn(page, user);

    await page.getByRole('button', { name: 'Complete: Done today' }).click();
    await expect(page.getByRole('button', { name: 'Mark not done: Done today' })).toBeVisible();

    const oldToday = today();
    await page.clock.fastForward(nextMidnight(now).getTime() - now.getTime() + 60_000);

    // Yesterday's completed task is gone; its open task is now overdue.
    const yesterday = section(page, formatWeekdayDate(oldToday));
    await expect(yesterday.getByText('Overdue')).toBeVisible();
    await expect.poll(() => titlesIn(yesterday)).toEqual(['Still open']);
    await expect(page.getByRole('button', { name: /Done today/ })).toHaveCount(0);
    await expect(section(page, 'Today').getByText(formatWeekdayDate(addDays(oldToday, 1)))).toBeVisible();
  });
});

test.describe('live updates', () => {
  test('changes made on another device appear without reloading', async ({ page, user }) => {
    const subscribed = page.waitForResponse(
      (res) => res.url().includes('/api/realtime') && res.request().method() === 'POST',
    );
    await signIn(page, user);
    await subscribed;

    const task = await createTask(user, { title: 'Added elsewhere' });
    await expect(row(section(page, 'Today'), 'Added elsewhere')).toBeVisible();

    await user.api.send(`/api/tasks/${task.id}/complete`, { method: 'POST' });
    await expect(page.getByRole('button', { name: 'Mark not done: Added elsewhere' })).toBeVisible();

    await user.api.collection('tasks').update(task.id, { title: 'Renamed elsewhere' });
    await expect(page.getByRole('button', { name: 'Mark not done: Renamed elsewhere' })).toBeVisible();
  });
});

test.describe('session', () => {
  test('a revoked session returns to the sign-in screen', async ({ signedIn: page, user, admin }) => {
    // Changing the password invalidates existing sessions.
    const password = 'a-new-password-123';
    await admin.collection('users').update(user.id, { password, passwordConfirm: password });

    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('editing rules', () => {
  test('quick-add ignores blank input', async ({ signedIn: page }) => {
    const input = page.getByPlaceholder('Add a task for today');
    await input.fill('   ');
    await input.press('Enter');
    await input.fill('Real task');
    await input.press('Enter');
    await expect.poll(() => titlesIn(section(page, 'Today'))).toEqual(['Real task']);
  });

  test('Escape cancels a title edit', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Original' });
    await page.reload();

    const title = row(page, 'Original').getByRole('textbox', { name: 'Title' });
    await title.click();
    await title.fill('Changed my mind');
    await title.press('Escape');
    await expect(title).toHaveValue('Original');

    await page.reload();
    await expect(row(page, 'Original')).toBeVisible();
  });

  test('clearing a title restores the old one', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Keep me' });
    await page.reload();

    const title = row(page, 'Keep me').getByRole('textbox', { name: 'Title' });
    await title.click();
    await title.fill('');
    await title.press('Enter');
    await expect(title).toHaveValue('Keep me');

    await page.reload();
    await expect(row(page, 'Keep me')).toBeVisible();
  });

  test('a completed task’s title, date, and priority are locked', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Finished' });
    await page.reload();
    await page.getByRole('button', { name: 'Complete: Finished' }).click();

    const done = row(page, 'Finished');
    await expect(done.getByRole('button', { name: 'Mark not done: Finished' })).toBeVisible();
    await expect(done.getByRole('textbox', { name: 'Title' })).not.toBeEditable();
    await expect(done.getByLabel('Due date')).toBeDisabled();
    await expect(done.getByLabel('Priority')).toBeDisabled();
  });
});
