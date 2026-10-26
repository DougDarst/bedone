<script lang="ts">
  import { untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME, type DndEvent } from 'svelte-dnd-action';
  import { dayHeading } from '../lib/format';
  import { placeDroppedTask, type DaySection, type DropChanges } from '../lib/list';
  import type { IsoDate } from '../lib/recurrence';
  import type { Task } from '../lib/types';
  import TaskRow from './TaskRow.svelte';

  interface Props {
    section: DaySection;
    today: IsoDate;
    /** Just-completed tasks that keep their open position briefly. */
    settling: ReadonlySet<string>;
    /** Changes whenever a drop finishes, so every day re-syncs with saved data. */
    dropVersion: number;
    onToggle: (id: string, done: boolean) => Promise<void> | void;
    onDrop: (id: string, changes: DropChanges | null) => Promise<void>;
    onOpenNotes: (id: string) => void;
  }

  let { section, today, settling, dropVersion, onToggle, onDrop, onOpenNotes }: Props = $props();

  // A long press starts a drag on touch screens, so a normal swipe still scrolls.
  const LONG_PRESS_MS = 300;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const flipMs = reduceMotion ? 0 : 200;

  const heading = $derived(dayHeading(section.date, today, section.tasks.some((t) => !t.completed_at)));
  const headingId = $derived(`day-${section.date}`);

  // Open tasks can be dragged; completed ones are listed separately below them.
  const openTasks = $derived(section.tasks.filter((t) => !t.completed_at || settling.has(t.id)));
  const doneTasks = $derived(section.tasks.filter((t) => t.completed_at && !settling.has(t.id)));

  // The drag library reorders this local copy while dragging.
  let items = $state<Task[]>([]);
  let dragging = false;

  $effect(() => {
    void dropVersion;
    const latest = openTasks;
    if (!untrack(() => dragging)) items = latest;
  });

  function consider(event: CustomEvent<DndEvent<Task>>) {
    dragging = true;
    items = event.detail.items;
  }

  function finalize(event: CustomEvent<DndEvent<Task>>) {
    dragging = false;
    items = event.detail.items;
    const { id } = event.detail.info;
    // Both the origin and the target day get this event; the target saves.
    if (items.some((t) => t.id === id)) void onDrop(id, placeDroppedTask(items, id, section.date));
  }

  const isEmpty = $derived(items.length === 0 && doneTasks.length === 0);

  const isShadow = (task: Task) => Boolean((task as unknown as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME]);
</script>

<section aria-labelledby={headingId} data-date={section.date}>
  <div class="heading" class:today={heading.kind === 'today'}>
    <h2 id={headingId}>{heading.label}</h2>
    {#if heading.detail}
      <span class="detail" class:overdue={heading.kind === 'past'}>{heading.detail}</span>
    {/if}
  </div>

  <div class="zone" class:empty={isEmpty}>
    {#if isEmpty}
      <p class="placeholder">Nothing planned</p>
    {/if}
    <ul
      class="open"
      aria-label="{heading.label} tasks"
      use:dndzone={{
        items,
        flipDurationMs: flipMs,
        type: 'task',
        delayTouchStart: LONG_PRESS_MS,
        dropTargetStyle: {},
        zoneTabIndex: -1,
      }}
      onconsider={consider as (e: CustomEvent) => void}
      onfinalize={finalize as (e: CustomEvent) => void}
    >
      {#each items as task (task.id)}
        <li class:shadow={isShadow(task)} animate:flip={{ duration: flipMs }}>
          <TaskRow {task} {today} {onToggle} {onOpenNotes} />
        </li>
      {/each}
    </ul>
  </div>

  {#if doneTasks.length}
    <ul class="done">
      {#each doneTasks as task (task.id)}
        <li animate:flip={{ duration: flipMs }}>
          <TaskRow {task} {today} {onToggle} {onOpenNotes} />
        </li>
      {/each}
    </ul>
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

  .zone {
    position: relative;
  }

  .open {
    min-height: 8px;
  }

  /* An empty day is still a drop target: the list fills the dashed box. */
  .zone.empty {
    margin: 8px 16px 10px;
    border: 1.5px dashed var(--control);
    border-radius: var(--radius-button);
  }

  .zone.empty .open {
    min-height: 40px;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 13px;
    color: var(--muted);
    pointer-events: none;
  }

  li {
    outline-offset: -2px;
  }

  /* Where the dragged task will land. */
  li.shadow {
    opacity: 0.35;
  }
</style>
