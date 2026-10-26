<script lang="ts">
  import { WifiOff } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { appDisplayName } from '../lib/config';
  import { connection } from '../lib/state/connection.svelte';

  let checking = $state(false);
  let dialog = $state<HTMLDialogElement>();

  // A modal dialog sits above everything, including an open notes modal.
  onMount(() => dialog?.showModal());

  async function retry() {
    checking = true;
    await connection.check();
    checking = false;
  }
</script>

<dialog
  bind:this={dialog}
  class="overlay"
  role="alertdialog"
  aria-labelledby="offline-title"
  aria-describedby="offline-body"
  oncancel={(e) => e.preventDefault()}
>
  <div class="card">
    <WifiOff size={32} aria-hidden="true" />
    <h1 id="offline-title">Can’t reach {appDisplayName()}</h1>
    <p id="offline-body">Your tasks are safe. Editing is paused until the connection comes back. We’ll keep trying.</p>
    <button class="button-primary" onclick={retry} disabled={checking}>
      {checking ? 'Checking…' : 'Try again'}
    </button>
  </div>
</dialog>

<style>
  .overlay {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    margin: 0;
    border: 0;
    padding: 16px;
    background: var(--bg);
    color: var(--text);
  }

  .overlay[open] {
    display: flex;
    align-items: center;
    justify-content: center;
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
