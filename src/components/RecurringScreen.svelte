<script lang="ts">
  import { ChevronRight, Plus } from '@lucide/svelte';
  import { onDestroy, onMount } from 'svelte';
  import { formatWeekdayDate } from '../lib/format';
  import { describeSchedule } from '../lib/schedule';
  import { clock } from '../lib/state/clock.svelte';
  import { connection } from '../lib/state/connection.svelte';
  import { ruleStore } from '../lib/state/rules.svelte';
  import { PRIORITY_LABELS, type Frequency, type RecurringRule } from '../lib/types';
  import RuleEditor from './RuleEditor.svelte';

  const sections: { frequency: Frequency; title: string; empty: string }[] = [
    { frequency: 'daily', title: 'Daily', empty: 'No daily tasks yet' },
    { frequency: 'weekly', title: 'Weekly', empty: 'No weekly tasks yet' },
    { frequency: 'monthly', title: 'Monthly', empty: 'No monthly tasks yet' },
  ];

  /** The rule being edited, or the frequency of a new one. */
  let editing = $state<{ frequency: Frequency; rule?: RecurringRule } | null>(null);

  const rulesFor = (frequency: Frequency) =>
    ruleStore.rules
      .filter((r) => r.frequency === frequency)
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

  onMount(() => {
    void ruleStore.load();
    return connection.onReconnect(() => void ruleStore.load());
  });

  onDestroy(() => void ruleStore.reset());
</script>

<main>
  <h2 class="screen-title">Recurring tasks</h2>

  {#if ruleStore.error}
    <p class="error" role="alert">{ruleStore.error}</p>
  {/if}

  {#if ruleStore.loaded}
    {#each sections as section (section.frequency)}
      {@const rules = rulesFor(section.frequency)}
      <section aria-labelledby="rules-{section.frequency}">
        <div class="heading">
          <h3 id="rules-{section.frequency}">{section.title}</h3>
          <button class="add" onclick={() => (editing = { frequency: section.frequency })}>
            <Plus size={18} aria-hidden="true" />
            <span>Add <span class="visually-hidden">{section.title.toLowerCase()} task</span></span>
          </button>
        </div>

        {#if rules.length}
          <ul>
            {#each rules as rule (rule.id)}
              {@const due = ruleStore.nextDue[rule.id]}
              <li>
                <button class="rule" onclick={() => (editing = { frequency: rule.frequency, rule })}>
                  <span class="dot" style:background="var(--priority-{rule.priority})" aria-hidden="true"></span>
                  <span class="text">
                    <span class="title">{rule.title}</span>
                    <span class="meta">
                      {describeSchedule(rule)}
                      <span class="visually-hidden">· {PRIORITY_LABELS[rule.priority]} priority</span>
                      {#if due}
                        · <span class:overdue={due < clock.today}>
                          {due < clock.today ? 'Overdue' : 'Next'}: {due === clock.today
                            ? 'Today'
                            : formatWeekdayDate(due)}
                        </span>
                      {/if}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty">{section.empty}</p>
        {/if}
      </section>
    {/each}
  {:else}
    <p class="loading" aria-live="polite">Loading…</p>
  {/if}
</main>

{#if editing}
  <RuleEditor frequency={editing.frequency} rule={editing.rule} onClose={() => (editing = null)} />
{/if}

<style>
  main {
    max-width: var(--list-max-width);
    margin: 0 auto;
    padding-bottom: 48px;
  }

  .screen-title {
    margin: 0;
    padding: 20px 16px 4px;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 8px 6px 16px;
    border-bottom: 1px solid var(--divider);
  }

  h3 {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap);
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-strong);
  }

  .add:hover {
    background: var(--accent-soft);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .rule {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 10px 12px 10px 16px;
    border: 0;
    border-bottom: 1px solid var(--divider);
    background: transparent;
    text-align: left;
    color: var(--muted);
  }

  .rule:hover {
    background: var(--surface);
  }

  .dot {
    flex-shrink: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title {
    font-size: 16px;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: 13px;
    font-weight: 500;
  }

  .overdue {
    color: var(--overdue);
  }

  .empty,
  .loading {
    margin: 0;
    padding: 14px 16px;
    font-size: 14px;
    color: var(--muted);
  }

  .error {
    margin: 8px 16px;
    padding: 10px 14px;
    border-radius: var(--radius-input);
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: 14px;
    color: var(--overdue);
  }
</style>
