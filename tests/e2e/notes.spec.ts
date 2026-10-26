import type { Page } from '@playwright/test';
import { createTask, expect, row, test, type TestUser } from './fixtures';

const notesDialog = (page: Page) => page.getByRole('dialog');
const editor = (page: Page) => notesDialog(page).getByLabel('Notes');

async function openNotes(page: Page, title: string) {
  await row(page, title).getByRole('button', { name: new RegExp(`(Add|Open) notes: ${title}`) }).click();
  await expect(notesDialog(page)).toBeVisible();
}

async function savedNotes(user: TestUser, title: string): Promise<string> {
  const task = await user.api.collection('tasks').getFirstListItem(user.api.filter('title = {:title}', { title }));
  return task.notes as string;
}

test.describe('notes', () => {
  test('rich text saves automatically and is there next time', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Plan trip' });
    await page.reload();
    await openNotes(page, 'Plan trip');

    await editor(page).click();
    await notesDialog(page).getByRole('button', { name: 'Bold' }).click();
    await page.keyboard.type('Important');
    await notesDialog(page).getByRole('button', { name: 'Bold' }).click();
    await page.keyboard.type(' details');

    // Saves without closing.
    await expect.poll(() => savedNotes(user, 'Plan trip')).toContain('<strong>Important</strong> details');
    await expect(notesDialog(page).getByText('Saved', { exact: true })).toBeVisible();

    await notesDialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(notesDialog(page)).toHaveCount(0);
    // The notes button now shows that the task has notes.
    await expect(row(page, 'Plan trip').getByRole('button', { name: 'Open notes: Plan trip' })).toBeVisible();

    await page.reload();
    await openNotes(page, 'Plan trip');
    await expect(editor(page).locator('strong')).toHaveText('Important');
  });

  test('lists, checklists, and links', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Packing' });
    await page.reload();
    await openNotes(page, 'Packing');
    const dialog = notesDialog(page);

    await editor(page).click();
    await dialog.getByRole('button', { name: 'Checklist' }).click();
    await page.keyboard.type('Passport');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // leave the checklist
    await dialog.getByRole('button', { name: 'Numbered list' }).click();
    await page.keyboard.type('Gate');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    await dialog.getByRole('button', { name: 'Link' }).click();
    await dialog.getByLabel('Link address').fill('example.com/flights');
    await dialog.getByRole('button', { name: 'Add' }).click();

    await dialog.getByRole('button', { name: 'Done' }).click();
    const notes = await savedNotes(user, 'Packing');
    expect(notes).toContain('data-type="taskList"');
    expect(notes).toContain('Passport');
    expect(notes).toMatch(/<ol[^>]*>.*Gate/);
    expect(notes).toContain('href="https://example.com/flights"');
  });

  test('Escape closes and saves', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Quick note' });
    await page.reload();
    await openNotes(page, 'Quick note');

    await editor(page).click();
    await page.keyboard.type('Saved on Escape');
    await page.keyboard.press('Escape');
    await expect(notesDialog(page)).toHaveCount(0);
    expect(await savedNotes(user, 'Quick note')).toContain('Saved on Escape');
  });

  test('the title can be edited in the modal', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Old name' });
    await page.reload();
    await openNotes(page, 'Old name');

    const title = notesDialog(page).getByRole('textbox', { name: 'Title' });
    await title.fill('New name');
    await title.press('Enter');
    await notesDialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(row(page, 'New name')).toBeVisible();
  });

  test('one-offs can be marked as projects; recurring tasks cannot', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'Remodel kitchen' });
    await user.api
      .collection('recurring_rules')
      .create({ owner: user.id, title: 'Daily walk', priority: 'medium', frequency: 'daily' });
    await page.reload();

    await openNotes(page, 'Remodel kitchen');
    await notesDialog(page).getByRole('switch', { name: 'Project' }).check();
    await notesDialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(row(page, 'Remodel kitchen').getByRole('img', { name: 'Project' })).toBeVisible();

    await openNotes(page, 'Remodel kitchen');
    await notesDialog(page).getByRole('switch', { name: 'Project' }).uncheck();
    await notesDialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(row(page, 'Remodel kitchen').getByRole('img', { name: 'Project' })).toHaveCount(0);

    await openNotes(page, 'Daily walk');
    await expect(notesDialog(page).getByRole('switch', { name: 'Project' })).toHaveCount(0);
  });

  test('a completed task’s title is read-only in the modal', async ({ signedIn: page, user }) => {
    await createTask(user, { title: 'All done' });
    await page.reload();
    await page.getByRole('button', { name: 'Complete: All done' }).click();
    await openNotes(page, 'All done');
    await expect(notesDialog(page).getByRole('textbox', { name: 'Title' })).not.toBeEditable();
  });

  test('notes not yet saved when the connection drops are kept and saved afterwards', async ({
    signedIn: page,
    user,
    context,
  }) => {
    await createTask(user, { title: 'Offline note' });
    await page.reload();
    await openNotes(page, 'Offline note');

    await editor(page).click();
    await page.keyboard.type('Typed before the drop');
    // The connection drops before the autosave runs.
    await context.setOffline(true);
    const offline = page.getByRole('alertdialog', { name: /Can’t reach/ });
    await expect(offline).toBeVisible();
    expect(await savedNotes(user, 'Offline note')).toBe('');

    await context.setOffline(false);
    await expect(offline).toHaveCount(0);
    await expect(editor(page)).toContainText('Typed before the drop');
    await notesDialog(page).getByRole('button', { name: 'Done' }).click();
    await expect(notesDialog(page)).toHaveCount(0);
    expect(await savedNotes(user, 'Offline note')).toContain('Typed before the drop');
  });
});
