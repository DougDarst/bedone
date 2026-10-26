<script lang="ts">
  import { WifiOff } from '@lucide/svelte';
  import { appDisplayName } from '../lib/config';
  import { connection } from '../lib/state/connection.svelte';

  let checking = $state(false);

  async function retry() {
    checking = true;
    await connection.check();
    checking = false;
  }
</script>

<div class="overlay" role="alertdialog" aria-modal="true" aria-labelledby="offline-title" aria-describedby="offline-body">
  <div class="card">
    <WifiOff size={32} aria-hidden="true" />
    <h1 id="offline-title">Can’t reach {appDisplayName()}</h1>
    <p id="offline-body">Your tasks are safe. Editing is paused until the connection comes back. We’ll keep trying.</p>
    <button class="button-primary" onclick={retry} disabled={checking}>
      {checking ? 'Checking…' : 'Try again'}
    </button>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--bg);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 340px;
    text-align: center;
    color: var(--muted);
  }

  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    color: var(--text);
  }

  p {
    margin: 0 0 8px;
    font-size: 14px;
    line-height: 1.5;
  }
</style>
