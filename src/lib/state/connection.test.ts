// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

async function freshConnection() {
  vi.resetModules();
  return import('./connection.svelte');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const healthy = () => fetchMock.mockResolvedValue({ ok: true });
const down = () => fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

describe('connection', () => {
  it('fires reconnect handlers once, only when coming back online', async () => {
    const { connection } = await freshConnection();
    const handler = vi.fn();
    connection.onReconnect(handler);

    healthy();
    await connection.check(); // already online: not a reconnect
    expect(handler).not.toHaveBeenCalled();

    connection.markOffline();
    expect(connection.online).toBe(false);
    await connection.check();
    expect(connection.online).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    await connection.check();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stays offline while the server is unreachable, retrying until it answers', async () => {
    const { connection } = await freshConnection();
    down();
    connection.markOffline();

    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(connection.online).toBe(false);

    healthy();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(connection.online).toBe(true);
  });

  it('notices the server going away through the heartbeat', async () => {
    const { connection } = await freshConnection();
    connection.start();
    down();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(connection.online).toBe(false);
  });

  it('goes offline immediately when the browser reports it', async () => {
    const { connection } = await freshConnection();
    connection.start();
    window.dispatchEvent(new Event('offline'));
    expect(connection.online).toBe(false);
  });

  it('removing a handler stops it being called', async () => {
    const { connection } = await freshConnection();
    const handler = vi.fn();
    const remove = connection.onReconnect(handler);
    remove();

    connection.markOffline();
    healthy();
    await connection.check();
    expect(handler).not.toHaveBeenCalled();
  });

  it('treats only status 0 as a network error', async () => {
    const { isNetworkError } = await freshConnection();
    expect(isNetworkError({ status: 0 })).toBe(true);
    expect(isNetworkError({ status: 400 })).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
