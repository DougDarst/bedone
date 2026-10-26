<script lang="ts">
  import { appDisplayName } from '../lib/config';
  import { connection, isNetworkError } from '../lib/state/connection.svelte';
  import { session } from '../lib/state/session.svelte';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    error = '';
    try {
      await session.login(email.trim(), password);
    } catch (err) {
      if (isNetworkError(err)) connection.markOffline();
      else error = 'That email and password don’t match.';
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <form onsubmit={submit}>
    <h1>{appDisplayName()}</h1>

    <label>
      <span>Email</span>
      <input type="email" autocomplete="username" required bind:value={email} />
    </label>

    <label>
      <span>Password</span>
      <input type="password" autocomplete="current-password" required bind:value={password} />
    </label>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button class="button-primary" type="submit" disabled={busy}>
      {busy ? 'Signing in…' : 'Sign in'}
    </button>
  </form>
</main>

<style>
  main {
    display: flex;
    justify-content: center;
    padding: 15vh 16px 32px;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 360px;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-align: center;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }

  input {
    height: 48px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    background: var(--surface);
    font-size: 16px;
    color: var(--text);
  }

  .error {
    margin: 0;
    font-size: 14px;
    color: var(--overdue);
  }
</style>
