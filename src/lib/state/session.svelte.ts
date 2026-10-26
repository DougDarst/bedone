import type { AuthRecord } from 'pocketbase';
import { pb } from '../pb';

/** The signed-in user, kept in sync with the PocketBase auth store. */
class Session {
  user = $state<AuthRecord>(pb.authStore.isValid ? pb.authStore.record : null);

  constructor() {
    pb.authStore.onChange((_token, record) => {
      this.user = pb.authStore.isValid ? record : null;
    });
  }

  async login(email: string, password: string): Promise<void> {
    await pb.collection('users').authWithPassword(email, password);
  }

  logout(): void {
    pb.realtime.unsubscribe();
    pb.authStore.clear();
  }

  /** Confirms a saved session is still valid; signs out if the server rejects it. */
  async refresh(): Promise<void> {
    if (!pb.authStore.isValid) return;
    try {
      await pb.collection('users').authRefresh();
    } catch (err) {
      if ((err as { status?: number }).status === 401) this.logout();
      else throw err;
    }
  }
}

export const session = new Session();
