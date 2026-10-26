<script lang="ts">
  import { Bold, Italic, Link, List, ListChecks, ListOrdered, X } from '@lucide/svelte';
  import { Editor } from '@tiptap/core';
  import { TaskItem, TaskList } from '@tiptap/extension-list';
  import StarterKit from '@tiptap/starter-kit';
  import { onMount, tick, untrack } from 'svelte';
  import { taskStore } from '../lib/state/tasks.svelte';
  import type { Task } from '../lib/types';

  interface Props {
    task: Task;
    onClose: () => void;
  }

  let { task, onClose }: Props = $props();

  /** Notes save this long after the last keystroke. */
  const SAVE_DELAY_MS = 600;

  let dialog = $state<HTMLDialogElement>();
  let editorEl = $state<HTMLDivElement>();
  let editor = $state.raw<Editor>();
  // Bumped on every editor change so the toolbar's active states update.
  let editorState = $state(0);

  // Editing starts from the values when the modal opened; later saves don't reset what's being typed.
  let title = $state(untrack(() => task.title));
  let status = $state<'saved' | 'saving' | 'unsaved'>('saved');
  let lastSaved = untrack(() => task.notes);
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<boolean> | null = null;

  let linkOpen = $state(false);
  let linkUrl = $state('');
  let linkInput = $state<HTMLInputElement>();

  const done = $derived(Boolean(task.completed_at));

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          link: {
            openOnClick: false,
            autolink: true,
            defaultProtocol: 'https',
            HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
          },
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
      ],
      content: task.notes,
      editorProps: { attributes: { 'aria-label': 'Notes', class: 'notes-editor' } },
      onTransaction: () => editorState++,
      onUpdate: scheduleSave,
    });
    dialog?.showModal();
    return () => {
      clearTimeout(saveTimer);
      editor?.destroy();
    };
  });

  function currentNotes(): string {
    if (!editor || editor.isEmpty) return '';
    return editor.getHTML();
  }

  function scheduleSave() {
    status = currentNotes() === lastSaved ? 'saved' : 'unsaved';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveNotes(), SAVE_DELAY_MS);
  }

  /** Saves the notes if they changed. Resolves to false if the save failed. */
  async function saveNotes(): Promise<boolean> {
    clearTimeout(saveTimer);
    if (saving) await saving;
    const notes = currentNotes();
    if (notes === lastSaved) {
      status = 'saved';
      return true;
    }
    status = 'saving';
    saving = taskStore.update(task.id, { notes });
    const ok = await saving;
    saving = null;
    if (ok) lastSaved = notes;
    status = currentNotes() === lastSaved ? 'saved' : 'unsaved';
    return ok;
  }

  async function saveTitle() {
    const trimmed = title.trim();
    if (!trimmed) {
      title = task.title;
      return;
    }
    if (trimmed !== task.title) await taskStore.update(task.id, { title: trimmed });
  }

  let closing = false;

  /** Closes only once everything is saved, so notes are never lost. */
  async function close() {
    if (closing) return;
    closing = true;
    try {
      await saveTitle();
      if (!(await saveNotes())) return;
      dialog?.close();
      onClose();
    } finally {
      closing = false;
    }
  }

  /** Escape closes the link field if it's open, otherwise the modal (after saving). */
  function escape() {
    if (linkOpen) {
      linkOpen = false;
      editor?.commands.focus();
      return;
    }
    void close();
  }

  // Handle Escape before anything inside the dialog can swallow it; the
  // browser's own "cancel" covers other ways of dismissing the dialog.
  function onKeydownCapture(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    escape();
  }

  function onCancel(event: Event) {
    event.preventDefault();
    escape();
  }

  /** Keeps focus (and the cursor position) in the editor when a toolbar button is clicked. */
  const keepEditorFocus = (event: MouseEvent) => event.preventDefault();

  function toggleProject(event: Event) {
    void taskStore.update(task.id, { is_project: (event.currentTarget as HTMLInputElement).checked });
  }

  const isActive = (name: string) => {
    void editorState;
    return editor?.isActive(name) ?? false;
  };

  async function startLink() {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    linkUrl = '';
    linkOpen = true;
    await tick();
    linkInput?.focus();
  }

  function applyLink(event: SubmitEvent) {
    event.preventDefault();
    const url = linkUrl.trim();
    linkOpen = false;
    if (!editor || !url) return;
    const href = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
  }

  const statusText = $derived(
    status === 'saving' ? 'Saving…' : status === 'unsaved' ? 'Not saved yet' : 'Saved',
  );
</script>

<dialog
  bind:this={dialog}
  class="notes-modal"
  aria-labelledby="notes-title-label"
  oncancel={onCancel}
  onkeydowncapture={onKeydownCapture}
>
  <!-- Focus lands here on open (not on Done, and not in the editor, which would pop up the phone keyboard). -->
  <!-- svelte-ignore a11y_autofocus -->
  <div class="sheet" tabindex="-1" autofocus>
    <header>
      <span class="status" aria-live="polite">{statusText}</span>
      <button class="done-button" onclick={close}>
        <X size={18} aria-hidden="true" />
        Done
      </button>
    </header>

    <label class="title-field">
      <span id="notes-title-label" class="visually-hidden">Title</span>
      <input
        type="text"
        aria-labelledby="notes-title-label"
        maxlength="500"
        readonly={done}
        bind:value={title}
        onblur={saveTitle}
        onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
    </label>

    {#if task.type === 'one_off'}
      <label class="project">
        <input type="checkbox" role="switch" checked={task.is_project} onchange={toggleProject} />
        <span class="switch" aria-hidden="true"></span>
        Project
      </label>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="toolbar" role="toolbar" aria-label="Formatting" tabindex="-1" onmousedown={keepEditorFocus}>
      <button
        aria-label="Bold"
        aria-pressed={isActive('bold')}
        onclick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="Italic"
        aria-pressed={isActive('italic')}
        onclick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="Bulleted list"
        aria-pressed={isActive('bulletList')}
        onclick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="Numbered list"
        aria-pressed={isActive('orderedList')}
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={18} aria-hidden="true" />
      </button>
      <button
        aria-label="Checklist"
        aria-pressed={isActive('taskList')}
        onclick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <ListChecks size={18} aria-hidden="true" />
      </button>
      <button aria-label="Link" aria-pressed={isActive('link')} onclick={startLink}>
        <Link size={18} aria-hidden="true" />
      </button>
    </div>

    {#if linkOpen}
      <form class="link-form" onsubmit={applyLink}>
        <input
          bind:this={linkInput}
          bind:value={linkUrl}
          type="text"
          inputmode="url"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="Paste or type a link"
          aria-label="Link address"
        />
        <button class="button-primary" type="submit">Add</button>
      </form>
    {/if}

    <div class="editor" bind:this={editorEl}></div>
  </div>
</dialog>

<style>
  .notes-modal {
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: var(--surface);
    color: var(--text);
  }

  .notes-modal::backdrop {
    background: rgb(0 0 0 / 0.35);
  }

  @media (min-width: 720px) {
    .notes-modal {
      width: min(640px, calc(100% - 32px));
      height: min(720px, calc(100% - 64px));
      margin: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-modal);
    }
  }

  .sheet {
    outline: none;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px 16px 16px;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap);
  }

  .status {
    font-size: 13px;
    color: var(--muted);
  }

  .done-button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--tap);
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-strong);
  }

  .title-field input {
    width: 100%;
    padding: 8px 0;
    border: 0;
    border-bottom: 1px solid var(--divider);
    outline: none;
    background: transparent;
    font-size: 20px;
    font-weight: 650;
  }

  .title-field input:focus {
    border-bottom-color: var(--accent);
  }

  .project {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    font-size: 15px;
    cursor: pointer;
  }

  .project {
    position: relative;
  }

  /* The real checkbox sits invisibly over the drawn switch, so it's what gets clicked. */
  .project input {
    position: absolute;
    top: 50%;
    left: 0;
    width: 40px;
    height: 24px;
    margin: 0;
    opacity: 0;
    transform: translateY(-50%);
    cursor: pointer;
    z-index: 1;
  }

  .switch {
    position: relative;
    pointer-events: none;
    width: 40px;
    height: 24px;
    border-radius: 12px;
    background: var(--control);
    transition: background-color 150ms ease-out;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--surface);
    transition: transform 150ms ease-out;
  }

  .project input:checked + .switch {
    background: var(--accent);
  }

  .project input:checked + .switch::after {
    transform: translateX(16px);
  }

  .project input:focus-visible + .switch {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .toolbar {
    display: flex;
    gap: 2px;
    padding: 6px 0;
    border-bottom: 1px solid var(--divider);
  }

  .toolbar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--tap);
    height: var(--tap);
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    color: var(--muted);
  }

  .toolbar button[aria-pressed='true'] {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .link-form {
    display: flex;
    gap: 8px;
    padding: 8px 0;
  }

  .link-form input {
    flex: 1;
    min-width: 0;
    height: var(--tap);
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-input);
    background: var(--bg);
    font-size: 16px;
  }

  .editor {
    flex: 1;
    overflow-y: auto;
    padding-top: 12px;
  }

  .editor :global(.notes-editor) {
    min-height: 100%;
    outline: none;
    font-size: 16px;
    line-height: 1.5;
  }

  .editor :global(.notes-editor p) {
    margin: 0 0 8px;
  }

  .editor :global(.notes-editor a) {
    color: var(--accent-strong);
  }

  .editor :global(ul[data-type='taskList']) {
    padding-left: 4px;
    list-style: none;
  }

  .editor :global(ul[data-type='taskList'] li) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .editor :global(ul[data-type='taskList'] li > label) {
    margin-top: 3px;
  }

  .editor :global(input[type='checkbox']) {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
  }

  .editor :global(ul[data-type='taskList'] li[data-checked='true'] > div) {
    color: var(--muted);
    text-decoration: line-through;
  }
</style>
