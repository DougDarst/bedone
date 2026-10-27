<script lang="ts">
  import { Trash2 } from '@lucide/svelte';
  import { onMount, untrack } from 'svelte';
  import { formatWeekdayDate } from '../lib/format';
  import { firstOccurrence, parseIsoDate, weekdayOf } from '../lib/recurrence';
  import {
    describeSchedule,
    MONTH_WEEK_LABELS,
    MONTH_WEEKS,
    toRecurrenceRule,
    WEEKDAY_LONG,
    WEEKDAY_SHORT,
    WEEKDAYS_MONDAY_FIRST,
  } from '../lib/schedule';
  import { clock } from '../lib/state/clock.svelte';
  import { ruleStore, type RuleFields } from '../lib/state/rules.svelte';
  import {
    PRIORITIES,
    PRIORITY_LABELS,
    type Frequency,
    type MonthWeekValue,
    type Priority,
    type RecurringRule,
    type WeekdayValue,
  } from '../lib/types';

  interface Props {
    frequency: Frequency;
    /** The rule to edit; omitted when creating one. */
    rule?: RecurringRule;
    onClose: () => void;
  }

  let { frequency, rule, onClose }: Props = $props();

  const SUNDAY_FIRST: WeekdayValue[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const FREQUENCY_LABELS: Record<Frequency, string> = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };

  // New rules default to today's weekday (and its week of the month), which
  // is usually what's meant.
  const todayWeekday = SUNDAY_FIRST[weekdayOf(clock.today)]!;
  const todayMonthWeek = String(Math.min(4, Math.ceil(parseIsoDate(clock.today).day / 7))) as MonthWeekValue;

  const initial = untrack(() => rule);
  let title = $state(initial?.title ?? '');
  let priority = $state<Priority>(initial?.priority ?? 'medium');
  let weekdays = $state<WeekdayValue[]>(initial?.weekdays.length ? [...initial.weekdays] : [todayWeekday]);
  let monthWeek = $state<MonthWeekValue>((initial?.month_week || todayMonthWeek) as MonthWeekValue);
  let monthWeekday = $state<WeekdayValue>((initial?.month_weekday || todayWeekday) as WeekdayValue);

  let dialog = $state<HTMLDialogElement>();
  let titleInput = $state<HTMLInputElement>();
  let submitted = $state(false);
  let saving = $state(false);
  let confirmingDelete = $state(false);

  const schedule = $derived({
    frequency,
    weekdays: frequency === 'weekly' ? SUNDAY_FIRST.filter((d) => weekdays.includes(d)) : [],
    month_week: frequency === 'monthly' ? monthWeek : ('' as const),
    month_weekday: frequency === 'monthly' ? monthWeekday : ('' as const),
  });

  const titleError = $derived(title.trim() ? '' : 'Add a title.');
  const daysError = $derived(frequency === 'weekly' && weekdays.length === 0 ? 'Pick at least one day.' : '');
  const valid = $derived(!titleError && !daysError);
  const firstDue = $derived(
    !rule && !daysError ? firstOccurrence(toRecurrenceRule(schedule), clock.today) : null,
  );

  onMount(() => {
    ruleStore.error = '';
    dialog?.showModal();
    if (!rule) titleInput?.focus();
  });

  function toggleDay(day: WeekdayValue) {
    weekdays = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
  }

  function close() {
    dialog?.close();
    onClose();
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (!valid || saving) return;
    saving = true;
    const fields: Partial<RuleFields> = { title: title.trim(), priority };
    if (frequency === 'weekly') fields.weekdays = schedule.weekdays;
    if (frequency === 'monthly') {
      fields.month_week = monthWeek;
      fields.month_weekday = monthWeekday;
    }
    const ok = rule
      ? await ruleStore.update(rule.id, fields)
      : await ruleStore.create(frequency, fields as RuleFields);
    saving = false;
    if (ok) close();
  }

  async function confirmDelete() {
    if (!rule || saving) return;
    saving = true;
    const ok = await ruleStore.remove(rule.id);
    saving = false;
    if (ok) close();
  }
</script>

<dialog
  bind:this={dialog}
  class="rule-editor"
  aria-labelledby="rule-editor-title"
  oncancel={(e) => {
    e.preventDefault();
    close();
  }}
>
  <!-- When editing, focus lands on the form itself, not the title (which would pop up the phone keyboard). -->
  <!-- svelte-ignore a11y_autofocus, a11y_no_noninteractive_tabindex -->
  <form onsubmit={save} novalidate tabindex="-1" autofocus={Boolean(rule)}>
    <h2 id="rule-editor-title">
      {rule ? `Edit ${FREQUENCY_LABELS[frequency]} task` : `New ${FREQUENCY_LABELS[frequency]} task`}
    </h2>

    <label class="field">
      <span class="label">Title</span>
      <input
        bind:this={titleInput}
        bind:value={title}
        type="text"
        maxlength="500"
        autocomplete="off"
        aria-invalid={submitted && Boolean(titleError)}
        aria-describedby={submitted && titleError ? 'title-error' : undefined}
      />
      {#if submitted && titleError}
        <span id="title-error" class="field-error">{titleError}</span>
      {/if}
    </label>

    <fieldset>
      <legend class="label">Priority</legend>
      <div class="chips">
        {#each PRIORITIES as p (p)}
          <label class="chip">
            <input type="radio" name="priority" value={p} bind:group={priority} />
            <span class="dot" style:background="var(--priority-{p})" aria-hidden="true"></span>
            {PRIORITY_LABELS[p]}
          </label>
        {/each}
      </div>
    </fieldset>

    {#if frequency === 'weekly'}
      <fieldset aria-describedby={submitted && daysError ? 'days-error' : undefined}>
        <legend class="label">Repeats on</legend>
        <div class="chips days">
          {#each WEEKDAYS_MONDAY_FIRST as day (day)}
            <label class="chip day">
              <input type="checkbox" checked={weekdays.includes(day)} onchange={() => toggleDay(day)} />
              <span aria-hidden="true">{WEEKDAY_SHORT[day]}</span>
              <span class="visually-hidden">{WEEKDAY_LONG[day]}</span>
            </label>
          {/each}
        </div>
        {#if submitted && daysError}
          <span id="days-error" class="field-error">{daysError}</span>
        {/if}
      </fieldset>
    {:else if frequency === 'monthly'}
      <fieldset>
        <legend class="label">Repeats on the</legend>
        <div class="selects">
          <label>
            <span class="visually-hidden">Week of the month</span>
            <select bind:value={monthWeek}>
              {#each MONTH_WEEKS as week (week)}
                <option value={week}>{MONTH_WEEK_LABELS[week]}</option>
              {/each}
            </select>
          </label>
          <label>
            <span class="visually-hidden">Day of the week</span>
            <select bind:value={monthWeekday}>
              {#each WEEKDAYS_MONDAY_FIRST as day (day)}
                <option value={day}>{WEEKDAY_LONG[day]}</option>
              {/each}
            </select>
          </label>
          <span class="of">of each month</span>
        </div>
      </fieldset>
    {/if}

    <p class="summary" aria-live="polite">
      {describeSchedule(schedule)}
      {#if firstDue}
        · First one {firstDue === clock.today ? 'today' : formatWeekdayDate(firstDue)}
      {/if}
    </p>

    {#if ruleStore.error}
      <p class="form-error" role="alert">{ruleStore.error}</p>
    {/if}

    {#if confirmingDelete && rule}
      <div class="confirm" role="alertdialog" aria-labelledby="confirm-text">
        <p id="confirm-text">
          Delete “{rule.title}”? Its open task will be removed. Completed ones stay in your history.
        </p>
        <div class="actions">
          <button type="button" class="button-secondary" onclick={() => (confirmingDelete = false)}>Keep</button>
          <button type="button" class="confirm-delete" onclick={confirmDelete} disabled={saving}>Delete</button>
        </div>
      </div>
    {:else}
      <div class="actions">
        {#if rule}
          <button type="button" class="delete" onclick={() => (confirmingDelete = true)}>
            <Trash2 size={18} aria-hidden="true" />
            Delete
          </button>
        {/if}
        <span class="spacer"></span>
        <button type="button" class="button-secondary" onclick={close}>Cancel</button>
        <button type="submit" class="button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    {/if}
  </form>
</dialog>

<style>
  .rule-editor {
    width: min(480px, calc(100% - 32px));
    max-height: calc(100% - 32px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-modal);
    background: var(--surface);
    color: var(--text);
  }

  .rule-editor::backdrop {
    background: rgb(0 0 0 / 0.35);
  }

  form {
    outline: none;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }

  fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: 8px;
  }

  .field input,
  select {
    height: 48px;
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    background: var(--bg);
    font-size: 16px;
  }

  .field input[aria-invalid='true'] {
    border-color: var(--overdue);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--tap);
    padding: 0 14px;
    border: 1px solid var(--border);
    border-radius: 22px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }

  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }

  .chip.day {
    padding: 0;
  }

  .chip input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .chip:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 600;
  }

  .chip:has(input:focus-visible) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .selects {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .of {
    font-size: 15px;
    color: var(--muted);
  }

  .summary {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
  }

  .field-error,
  .form-error {
    margin: 0;
    font-size: 13px;
    color: var(--overdue);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .spacer {
    flex: 1;
  }

  .delete {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--tap);
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    background: transparent;
    font-size: 15px;
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    background: var(--bg);
  }

  .confirm p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .confirm .actions {
    justify-content: flex-end;
  }

  /* Neutral but strong: red is reserved for "overdue", and green would read as "safe". */
  .confirm-delete {
    min-height: var(--tap);
    padding: 0 20px;
    border: 0;
    border-radius: var(--radius-button);
    background: var(--text);
    color: var(--bg);
    font-size: 15px;
    font-weight: 600;
  }
</style>
