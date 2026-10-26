import { pb } from '../pb';

const HEARTBEAT_MS = 30_000;
const RETRY_MS = 3_000;

/**
 * Tracks whether the backend is reachable. The app is online-only: while
 * this is offline, a blocking screen prevents any edits (see SPEC
 * "Platform targets").
 */
class Connection {
  online = $state(true);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #reconnectHandlers: (() => void)[] = [];

  start(): void {
    window.addEventListener('offline', () => this.markOffline());
    window.addEventListener('online', () => void this.check());
    if (!navigator.onLine) this.markOffline();
    else this.#schedule(HEARTBEAT_MS);
  }

  /**
   * Registers a callback for when the connection comes back (e.g. to reload
   * data). Returns a function that removes it.
   */
  onReconnect(handler: () => void): () => void {
    this.#reconnectHandlers.push(handler);
    return () => {
      this.#reconnectHandlers = this.#reconnectHandlers.filter((h) => h !== handler);
    };
  }

  markOffline(): void {
    this.online = false;
    this.#schedule(RETRY_MS);
  }

  /** Pings the backend and updates `online`. */
  async check(): Promise<boolean> {
    let ok = false;
    try {
      const res = await fetch(`${pb.baseURL.replace(/\/$/, '')}/api/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    const wasOffline = !this.online;
    this.online = ok;
    this.#schedule(ok ? HEARTBEAT_MS : RETRY_MS);
    if (ok && wasOffline) this.#reconnectHandlers.forEach((h) => h());
    return ok;
  }

  #schedule(ms: number): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.check(), ms);
  }
}

export const connection = new Connection();

/** True when a request failed because the server couldn't be reached at all. */
export function isNetworkError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { status?: number }).status === 0;
}
