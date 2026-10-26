<script lang="ts">
  import type { Scope } from '../lib/list';
  import { filters } from '../lib/state/filters.svelte';
  import { PRIORITIES, PRIORITY_LABELS } from '../lib/types';

  const scopes: { value: Scope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
  ];
</script>

<div class="filters" role="toolbar" aria-label="Filters">
  <div class="group" role="group" aria-label="Show dates">
    {#each scopes as scope (scope.value)}
      <button
        class="chip"
        aria-pressed={filters.value.scope === scope.value}
        onclick={() => filters.setScope(scope.value)}
      >
        {scope.label}
      </button>
    {/each}
  </div>
  <span class="divider" aria-hidden="true"></span>
  <div class="group" role="group" aria-label="Show priorities">
    {#each PRIORITIES as priority (priority)}
      <button
        class="chip"
        aria-pressed={filters.value.priorities.includes(priority)}
        onclick={() => filters.togglePriority(priority)}
      >
        <span class="dot" style:background="var(--priority-{priority})" aria-hidden="true"></span>
        {PRIORITY_LABELS[priority]}
      </button>
    {/each}
  </div>
</div>

<style>
  .filters {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px 12px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .group {
    display: flex;
    gap: 8px;
  }

  .chip {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: transparent;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
  }

  .chip[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 600;
  }

  .divider {
    flex-shrink: 0;
    width: 1px;
    height: 24px;
    background: var(--border);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
</style>
