<script lang="ts">
  import { flip } from 'svelte/animate';
  import { dayHeading } from '../lib/format';
  import type { DaySection } from '../lib/list';
  import type { IsoDate } from '../lib/recurrence';
  import TaskRow from './TaskRow.svelte';

  interface Props {
    section: DaySection;
    today: IsoDate;
    onToggle: (id: string, done: boolean) => void;
  }

  let { section, today, onToggle }: Props = $props();

  const heading = $derived(dayHeading(section.date, today, section.tasks.some((t) => !t.completed_at)));
  const headingId = $derived(`day-${section.date}`);
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<section aria-labelledby={headingId} data-date={section.date}>
  <div class="heading" class:today={heading.kind === 'today'}>
    <h2 id={headingId}>{heading.label}</h2>
    {#if heading.detail}
      <span class="detail" class:overdue={heading.kind === 'past'}>{heading.detail}</span>
    {/if}
  </div>

  {#if section.tasks.length}
    <ul>
      {#each section.tasks as task (task.id)}
        <li animate:flip={{ duration: reduceMotion ? 0 : 250 }}>
          <TaskRow {task} {today} {onToggle} />
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">Nothing planned</p>
  {/if}
</section>

<style>
  .heading {
    position: sticky;
    top: var(--header-height);
    z-index: 10;
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 14px 16px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--divider);
  }

  .heading.today {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
  }

  .detail {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }

  .today .detail {
    color: var(--accent-strong);
  }

  .detail.overdue {
    color: var(--overdue);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    margin: 8px 16px 10px;
    border: 1.5px dashed var(--control);
    border-radius: var(--radius-button);
    font-size: 13px;
    color: var(--muted);
  }
</style>
