// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The filters module reads storage when first imported, so load a fresh copy per test. */
async function freshFilters() {
  vi.resetModules();
  return (await import('./filters.svelte')).filters;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('filters', () => {
  it('defaults to all dates and all priorities', async () => {
    expect((await freshFilters()).value).toEqual({ scope: 'all', priorities: [] });
  });

  it('restores saved filters, with priorities in High → Low order', async () => {
    localStorage.setItem('filters', JSON.stringify({ scope: 'week', priorities: ['low', 'high'] }));
    expect((await freshFilters()).value).toEqual({ scope: 'week', priorities: ['high', 'low'] });
  });

  it('drops unknown values from saved filters', async () => {
    localStorage.setItem('filters', JSON.stringify({ scope: 'month', priorities: ['urgent', 'low'] }));
    expect((await freshFilters()).value).toEqual({ scope: 'all', priorities: ['low'] });
  });

  it('ignores corrupted saved data', async () => {
    localStorage.setItem('filters', '{not json');
    expect((await freshFilters()).value).toEqual({ scope: 'all', priorities: [] });
  });

  it('works when storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const filters = await freshFilters();
    expect(filters.value.scope).toBe('all');
    filters.setScope('today');
    expect(filters.value.scope).toBe('today');
  });

  it('saves changes, and toggling a priority twice removes it', async () => {
    const filters = await freshFilters();
    filters.setScope('today');
    filters.togglePriority('low');
    filters.togglePriority('high');
    expect(filters.value).toEqual({ scope: 'today', priorities: ['high', 'low'] });
    expect(JSON.parse(localStorage.getItem('filters')!)).toEqual(filters.value);

    filters.togglePriority('high');
    expect(filters.value.priorities).toEqual(['low']);
  });
});
