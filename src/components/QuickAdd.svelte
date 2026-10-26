<script lang="ts">
  import { Plus } from '@lucide/svelte';
  import { clock } from '../lib/state/clock.svelte';
  import { taskStore } from '../lib/state/tasks.svelte';

  let title = $state('');
  let busy = $state(false);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    busy = true;
    // Keep the text if saving fails, so nothing typed is lost.
    if (await taskStore.add(trimmed, clock.today)) title = '';
    busy = false;
  }
</script>

<form onsubmit={submit}>
  <label>
    <Plus size={20} aria-hidden="true" />
    <span class="visually-hidden">Add a task for today</span>
    <input
      type="text"
      placeholder="Add a task for today"
      enterkeyhint="done"
      autocomplete="off"
      maxlength="500"
      bind:value={title}
    />
  </label>
</form>

<style>
  form {
    padding: 12px 16px 4px;
  }

  label {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 48px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    background: var(--surface);
    color: var(--accent);
  }

  label:focus-within {
    border-color: var(--accent);
  }

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font-size: 16px;
    color: var(--text);
  }

  input::placeholder {
    color: var(--muted);
  }
</style>
