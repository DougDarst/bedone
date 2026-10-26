// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function freshTheme() {
  vi.resetModules();
  return (await import('./theme.svelte')).theme;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('theme', () => {
  it('follows the system by default', async () => {
    const theme = await freshTheme();
    theme.apply();
    expect(theme.preference).toBe('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('restores a saved override and applies it', async () => {
    localStorage.setItem('theme', 'dark');
    const theme = await freshTheme();
    theme.apply();
    expect(theme.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('ignores an unknown saved value', async () => {
    localStorage.setItem('theme', 'purple');
    expect((await freshTheme()).preference).toBe('system');
  });

  it('saves an override, and going back to System clears it', async () => {
    const theme = await freshTheme();
    theme.set('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    theme.set('system');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
