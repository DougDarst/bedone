import type { Locator, Page } from '@playwright/test';
import { formatWeekdayDate } from '../../src/lib/format';
import { addDays } from '../../src/lib/recurrence';
import { createTask, expect, row, section, test, titlesIn, today } from './fixtures';

const tomorrow = () => addDays(today(), 1);
const tomorrowSection = (page: Page) => section(page, formatWeekdayDate(tomorrow()));

/**
 * Drags a task by its title onto a target element, with the mouse.
 * `edge` picks where on the target to drop.
 */
async function drag(page: Page, title: string, target: Locator, edge: 'top' | 'middle' | 'bottom' = 'top') {
  const handle = row(page, title).getByText(title, { exact: true });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 12, { steps: 4 }); // start the drag
  const targetY = { top: to.y + 4, middle: to.y + to.height / 2, bottom: to.y + to.height - 4 }[edge];
  // Straight up or down, the way a finger moves a list item.
  await page.mouse.move(x, targetY, { steps: 20 });
  // Hold still briefly, like a person does before letting go: the library
  // checks the dragged item's position on a timer.
  await page.waitForTimeout(400);
  await page.mouse.up();
}

test.describe('drag and drop', () => {
  test('drag a task onto an empty day', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Book flights' });
    await page.reload();

    await drag(page, 'Book flights', tomorrowSection(page).getByText('Nothing planned'));
    await expect(row(tomorrowSection(page), 'Book flights')).toBeVisible();
    await expect(row(section(page, 'Today'), 'Book flights')).toHaveCount(0);

    await page.reload();
    await expect(row(tomorrowSection(page), 'Book flights')).toBeVisible();
  });

  test('a task dropped on another day lands at the bottom of its priority group', async ({
    signedIn: page,
    user,
  }) => {
    await createTask(user, { title: 'Mover', priority: 'medium' });
    await createTask(user, { title: 'T high', priority: 'high', due_date: tomorrow() });
    await createTask(user, { title: 'T medium 1', priority: 'medium', due_date: tomorrow() });
    await createTask(user, { title: 'T medium 2', priority: 'medium', due_date: tomorrow() });
    await createTask(user, { title: 'T low', priority: 'low', due_date: tomorrow() });
    await page.reload();

    // Dropped at the very top of tomorrow, it still goes below the other Medium tasks.
    await drag(page, 'Mover', row(tomorrowSection(page), 'T high'), 'middle');
    await expect
      .poll(() => titlesIn(tomorrowSection(page)))
      .toEqual(['T high', 'T medium 1', 'T medium 2', 'Mover', 'T low']);

    await page.reload();
    await expect
      .poll(() => titlesIn(tomorrowSection(page)))
      .toEqual(['T high', 'T medium 1', 'T medium 2', 'Mover', 'T low']);
  });

  test('reorder tasks within a day', async ({ signedIn: page, user }) => {
    for (const title of ['A', 'B', 'C']) await createTask(user, { title });
    await page.reload();
    const todaySection = section(page, 'Today');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['A', 'B', 'C']);

    await drag(page, 'C', row(todaySection, 'A'));
    await expect.poll(() => titlesIn(todaySection)).toEqual(['C', 'A', 'B']);

    await page.reload();
    await expect.poll(() => titlesIn(todaySection)).toEqual(['C', 'A', 'B']);
  });

  test('a task dropped among another priority snaps back into its own group', async ({
    signedIn: page,
    user,
  }) => {
    await createTask(user, { title: 'High 1', priority: 'high' });
    await createTask(user, { title: 'Low 1', priority: 'low' });
    await createTask(user, { title: 'Low 2', priority: 'low' });
    await page.reload();
    const todaySection = section(page, 'Today');

    await drag(page, 'Low 2', row(todaySection, 'High 1'));
    await expect.poll(() => titlesIn(todaySection)).toEqual(['High 1', 'Low 2', 'Low 1']);

    await page.reload();
    await expect.poll(() => titlesIn(todaySection)).toEqual(['High 1', 'Low 2', 'Low 1']);
  });

  test('completed tasks cannot be dragged', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Finished' });
    await page.reload();
    await page.getByRole('button', { name: 'Complete: Finished' }).click();
    await expect(page.getByRole('button', { name: 'Mark not done: Finished' })).toBeVisible();
    await page.waitForTimeout(700); // let it settle into the completed list

    await drag(page, 'Finished', tomorrowSection(page).getByText('Nothing planned'));
    await expect(row(section(page, 'Today'), 'Finished')).toBeVisible();
    await expect(tomorrowSection(page).getByText('Nothing planned')).toBeVisible();
  });

  test('tasks can be reordered with the keyboard', async ({ signedIn: page, user }) => {
    for (const title of ['A', 'B', 'C']) await createTask(user, { title });
    await page.reload();
    const todaySection = section(page, 'Today');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['A', 'B', 'C']);

    await row(todaySection, 'A').locator('xpath=..').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    await expect.poll(() => titlesIn(todaySection)).toEqual(['B', 'A', 'C']);
  });
});
