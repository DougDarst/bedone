import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import PocketBase from 'pocketbase';
import { TIME_ZONE } from '../../src/lib/config';
import { todayIn } from '../../src/lib/recurrence';

const PORT = Number(process.env.E2E_PORT ?? 8097);
const URL = `http://127.0.0.1:${PORT}`;
const SUPERUSER = {
  email: process.env.E2E_SUPERUSER_EMAIL ?? 'e2e@example.test',
  password: process.env.E2E_SUPERUSER_PASSWORD ?? 'e2e-superuser-password',
};

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** API client logged in as this user, for seeding data. */
  api: PocketBase;
}

function client(): PocketBase {
  const pb = new PocketBase(URL);
  pb.autoCancellation(false);
  return pb;
}

export const today = (): string => todayIn(TIME_ZONE);

export const test = base.extend<{ admin: PocketBase; user: TestUser; signedIn: Page }>({
  admin: async ({}, use) => {
    const pb = client();
    await pb.collection('_superusers').authWithPassword(SUPERUSER.email, SUPERUSER.password);
    await use(pb);
  },

  // Each test gets its own user, so tests never see each other's data.
  user: async ({ admin }, use) => {
    const email = `e2e-${randomUUID()}@example.test`;
    const password = 'e2e-user-password';
    const record = await admin.collection('users').create({ email, password, passwordConfirm: password });
    const api = client();
    await api.collection('users').authWithPassword(email, password);
    await use({ id: record.id, email, password, api });
  },

  signedIn: async ({ page, user }, use) => {
    await signIn(page, user);
    await use(page);
  },
});

export { expect };

export async function signIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('region', { name: 'Today' })).toBeVisible();
}

/** A date section, by its heading ("Today", "Tue, Oct 27", …). */
export function section(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true });
}

/** The row for an open task, found by its title. */
export function row(scope: Page | Locator, title: string): Locator {
  // `has` must be built from the page, not the scope, so it's matched inside each row.
  const page = 'page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page);
  return scope.locator('[data-task-id]').filter({
    has: page.getByRole('button', { name: new RegExp(`^(Complete|Mark not done): ${escape(title)}$`) }),
  });
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Titles of the tasks in a section, top to bottom. */
export async function titlesIn(scope: Locator): Promise<string[]> {
  return scope.getByRole('textbox', { name: 'Title' }).evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );
}

export function createTask(user: TestUser, fields: Record<string, unknown>) {
  return user.api.collection('tasks').create({
    owner: user.id,
    type: 'one_off',
    priority: 'medium',
    due_date: today(),
    ...fields,
  });
}
