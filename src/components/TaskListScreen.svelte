<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { buildSections } from '../lib/list';
  import { clock } from '../lib/state/clock.svelte';
  import { connection } from '../lib/state/connection.svelte';
  import { filters } from '../lib/state/filters.svelte';
  import { taskStore } from '../lib/state/tasks.svelte';
  import DaySection from './DaySection.svelte';
  import FilterBar from './FilterBar.svelte';
  import Header from './Header.svelte';
  import QuickAdd from './QuickAdd.svelte';

  /** How long a just-completed task stays in place before sliding down (style guide › Motion). */
  const SETTLE_MS = 600;

  // Tasks just completed keep their open position briefly so a mis-tap can be undone in place.
  const settling = new SvelteSet<string>();

  const sections = $derived(buildSections(taskStore.tasks, clock.today, filters.value, settling));

  onMount(() => {
    void taskStore.load();
    return connection.onReconnect(() => void taskStore.load());
  });

  onDestroy(() => taskStore.reset());

  async function toggle(id: string, done: boolean) {
    if (!done) {
      settling.delete(id);
      await taskStore.uncomplete(id);
      return;
    }
    settling.add(id);
    const ok = await taskStore.complete(id);
    if (!ok) {
      settling.delete(id);
      return;
    }
    setTimeout(() => settling.delete(id), SETTLE_MS);
  }
</script>

<Header />

<main>
  <QuickAdd />
  <FilterBar />

  {#if taskStore.error}
    <p class="error" role="alert">{taskStore.error}</p>
  {/if}

  {#if taskStore.loaded}
    {#each sections as section (section.date)}
      <DaySection {section} today={clock.today} onToggle={toggle} />
    {/each}
  {:else}
    <p class="loading" aria-live="polite">Loading…</p>
  {/if}
</main>

<style>
  main {
    max-width: var(--list-max-width);
    margin: 0 auto;
    padding-bottom: 48px;
  }

  .error {
    margin: 0 16px 8px;
    padding: 10px 14px;
    border-radius: var(--radius-input);
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 14px;
    color: var(--overdue);
  }

  .loading {
    padding: 24px 16px;
    color: var(--muted);
  }
</style>
