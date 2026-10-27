// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { routeFromHash } from './router.svelte';

describe('routeFromHash', () => {
  it('maps hashes to screens, defaulting to the task list', () => {
    expect(routeFromHash('#/recurring')).toBe('recurring');
    expect(routeFromHash('#/')).toBe('tasks');
    expect(routeFromHash('')).toBe('tasks');
    expect(routeFromHash('#/nonsense')).toBe('tasks');
  });
});
