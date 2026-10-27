<script lang="ts">
  import { Check, ChevronDown, FileText, Folder, Repeat } from '@lucide/svelte';
  import { tick } from 'svelte';
  import { formatShortDate } from '../lib/format';
  import { isIsoDate, type IsoDate } from '../lib/recurrence';
  import { taskStore } from '../lib/state/tasks.svelte';
  import { PRIORITIES, PRIORITY_LABELS, type Priority, type Task } from '../lib/types';

  interface Props {
    task: Task;
    today: IsoDate;
    onToggle: (id: string, done: boolean) => Promise<void> | void;
    onOpenNotes: (id: string) => void;
  }

  let { task, today, onToggle, onOpenNotes }: Props = $props();

  const done = $derived(Boolean(task.completed_at));
  const overdue = $derived(!done && task.due_date < today);
  const recurring = $derived(task.type !== 'one_off');
  const hasNotes = $derived(task.notes.trim() !== '');

  // Shows the tick the moment it's tapped, while the server confirms.
  let pending = $state<boolean | null>(null);
  const checked = $derived(pending ?? done);

  // The title shows as text (so a long press can start a drag) and becomes
  // an input when tapped.
  let editing = $state(false);
  let draft = $state('');
  let input = $state<HTMLInputElement>();

  async function toggle() {
    if (pending !== null) return;
    pending = !checked;
    try {
      await onToggle(task.id, pending);
    } finally {
      pending = null;
    }
  }

  async function startEditing() {
    if (done) return;
    draft = task.title;
    editing = true;
    await tick();
    input?.focus();
    input?.setSelectionRange(draft.length, draft.length);
  }

  async function saveTitle() {
    if (!editing) return;
    editing = false;
    const title = draft.trim();
    if (title && title !== task.title) await taskStore.update(task.id, { title });
  }

  function onTitleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') input?.blur();
    if (event.key === 'Escape') {
      editing = false; // blur then has nothing to save
    }
  }

  function changeDate(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    if (isIsoDate(value) && value !== task.due_date) void taskStore.update(task.id, { due_date: value });
  }

  function openPicker(event: MouseEvent) {
    const picker = event.currentTarget as HTMLInputElement;
    try {
      picker.showPicker?.();
    } catch {
      // Some browsers only allow showPicker from certain gestures; the native control still works.
    }
  }

  function changePriority(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value as Priority;
    if (value !== task.priority) void taskStore.update(task.id, { priority: value });
  }
</script>

<div class="row" class:done data-task-id={task.id}>
  <button
    class="check"
    class:checked
    aria-label={checked ? `Mark not done: ${task.title}` : `Complete: ${task.title}`}
    aria-pressed={checked}
    onclick={toggle}
  >
    <span class="ring">
      <Check size={14} strokeWidth={3} aria-hidden="true" />
    </span>
  </button>

  <div class="title">
    {#if editing}
      <input
        bind:this={input}
        type="text"
        aria-label="Title"
        maxlength="500"
        enterkeyhint="done"
        bind:value={draft}
        onblur={saveTitle}
        onkeydown={onTitleKeydown}
      />
    {:else}
      <!-- Pointer shortcut for inline editing; keyboard users edit the title in the notes modal. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span class="title-text" class:overdue onclick={startEditing}>{task.title}</span>
    {/if}
    {#if task.is_project}
      <Folder size={15} role="img" aria-label="Project" class="kind-icon" />
    {/if}
    {#if recurring}
      <Repeat size={15} role="img" aria-label="Recurring" class="kind-icon" />
    {/if}
  </div>

  <button
    class="notes"
    class:has-notes={hasNotes}
    aria-label={hasNotes ? `Open notes: ${task.title}` : `Add notes: ${task.title}`}
    onclick={() => onOpenNotes(task.id)}
  >
    <FileText size={17} aria-hidden="true" />
  </button>

  <label class="date" class:overdue>
    <span aria-hidden="true">{formatShortDate(task.due_date)}</span>
    <input
      type="date"
      aria-label="Due date"
      value={task.due_date}
      disabled={done}
      onclick={openPicker}
      onchange={changeDate}
    />
  </label>

  <label class="priority">
    <span class="dot" style:background="var(--priority-{task.priority})" aria-hidden="true"></span>
    <span class="priority-label" aria-hidden="true">{PRIORITY_LABELS[task.priority]}</span>
    <ChevronDown size={13} aria-hidden="true" class="chevron" />
    <select aria-label="Priority" value={task.priority} disabled={done} onchange={changePriority}>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 48px;
    padding: 0 6px 0 4px;
    border-bottom: 1px solid var(--divider);
    background: var(--bg);
    /* A long press drags the task rather than selecting text. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .check,
  .notes {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    height: var(--tap);
    padding: 0;
    border: 0;
    background: transparent;
  }

  .check {
    width: var(--tap);
  }

  .notes {
    width: 34px;
    /* Quiet but still 3:1 against the background (WCAG non-text contrast). */
    color: var(--control);
  }

  .notes.has-notes {
    color: var(--accent);
  }

  .ring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 2px solid var(--control);
    border-radius: 50%;
    color: var(--on-accent);
    transition:
      background-color 180ms ease-out,
      border-color 180ms ease-out;
  }

  .ring :global(svg) {
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity 180ms ease-out,
      transform 180ms ease-out;
  }

  .checked .ring {
    border-color: var(--accent);
    background: var(--accent);
  }

  .checked .ring :global(svg) {
    opacity: 1;
    transform: scale(1);
  }

  .title {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: var(--tap);
    color: var(--muted);
  }

  .title-text,
  .title input {
    font-size: 16px;
    line-height: 1.3;
    color: var(--text);
  }

  .title-text {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    overflow-wrap: anywhere;
    cursor: text;
    transition: color 200ms ease-out;
  }

  .title input {
    flex: 1;
    min-width: 0;
    height: var(--tap);
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    user-select: text;
    -webkit-user-select: text;
  }

  .title-text.overdue,
  .date.overdue {
    color: var(--overdue);
  }

  .done .title-text {
    color: var(--muted);
    text-decoration: line-through;
    cursor: default;
  }

  .title :global(.kind-icon) {
    flex-shrink: 0;
  }

  .date,
  .priority {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    height: var(--tap);
    font-size: 13px;
    font-weight: 500;
    color: var(--muted);
  }

  .date {
    width: 52px;
  }

  .priority {
    gap: 4px;
    min-width: 40px;
    padding: 0 2px;
  }

  /* The native controls sit invisibly on top, so tapping opens the system picker. */
  .date input,
  .priority select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .date:has(:focus-visible),
  .priority:has(:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    border-radius: var(--radius-button);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .done .dot {
    opacity: 0.4;
  }

  .priority-label {
    display: none;
  }

  @media (min-width: 600px) {
    .priority {
      justify-content: flex-start;
      width: 92px;
      padding: 0 8px;
    }

    .priority-label {
      display: inline;
    }

    /* Chevrons line up whatever the label's length. */
    .priority :global(.chevron) {
      margin-left: auto;
    }
  }
</style>
