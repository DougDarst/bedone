<script lang="ts">
  import { ListTodo, LogOut, Menu, Monitor, Moon, Repeat, Sun } from '@lucide/svelte';
  import { appDisplayName } from '../lib/config';
  import { router, type Route } from '../lib/state/router.svelte';
  import { session } from '../lib/state/session.svelte';
  import { theme, type ThemePreference } from '../lib/state/theme.svelte';

  let open = $state(false);
  let menuEl = $state<HTMLElement>();
  let buttonEl = $state<HTMLButtonElement>();

  const themes: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  const screens: { route: Route; label: string; icon: typeof Sun }[] = [
    { route: 'tasks', label: 'Tasks', icon: ListTodo },
    { route: 'recurring', label: 'Recurring tasks', icon: Repeat },
  ];

  function close() {
    open = false;
    buttonEl?.focus();
  }

  function onWindowClick(event: MouseEvent) {
    const target = event.target as Node;
    if (open && !menuEl?.contains(target) && !buttonEl?.contains(target)) open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') close();
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<header>
  <div class="bar">
    <button
      bind:this={buttonEl}
      class="icon-button"
      aria-label="Menu"
      aria-expanded={open}
      aria-controls="app-menu"
      onclick={() => (open = !open)}
    >
      <Menu size={22} aria-hidden="true" />
    </button>
    <h1>{appDisplayName()}</h1>
  </div>

  {#if open}
    <div id="app-menu" class="menu" bind:this={menuEl}>
      <nav aria-label="Screens">
        {#each screens as screen (screen.route)}
          <a
            class="menu-item"
            href={router.href(screen.route)}
            aria-current={router.route === screen.route ? 'page' : undefined}
            onclick={() => (open = false)}
          >
            <screen.icon size={18} aria-hidden="true" />
            {screen.label}
          </a>
        {/each}
      </nav>
      <hr />
      <div class="group" role="group" aria-labelledby="theme-label">
        <span id="theme-label" class="group-label">Theme</span>
        <div class="segmented">
          {#each themes as option (option.value)}
            <button
              aria-pressed={theme.preference === option.value}
              onclick={() => theme.set(option.value)}
            >
              <option.icon size={16} aria-hidden="true" />
              {option.label}
            </button>
          {/each}
        </div>
      </div>
      <button class="menu-item" onclick={() => session.logout()}>
        <LogOut size={18} aria-hidden="true" />
        Sign out
      </button>
    </div>
  {/if}
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    max-width: var(--list-max-width);
    height: var(--header-height);
    margin: 0 auto;
    padding: 0 8px;
  }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  .menu {
    position: absolute;
    top: calc(var(--header-height) - 4px);
    left: max(8px, calc((100% - var(--list-max-width)) / 2 + 8px));
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(300px, calc(100% - 16px));
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-modal);
    background: var(--surface);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .segmented button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--tap);
    border: 1px solid var(--border);
    border-radius: var(--radius-button);
    background: transparent;
    font-size: 14px;
  }

  .segmented button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-weight: 600;
  }

  nav {
    display: flex;
    flex-direction: column;
  }

  hr {
    width: 100%;
    margin: 0;
    border: 0;
    border-top: 1px solid var(--divider);
  }

  a.menu-item {
    color: inherit;
    text-decoration: none;
  }

  a.menu-item[aria-current='page'] {
    font-weight: 600;
    color: var(--accent-strong);
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: var(--tap);
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-button);
    background: transparent;
    font-size: 15px;
    text-align: left;
  }

  .menu-item:hover,
  .segmented button:hover {
    background: var(--accent-soft);
  }
</style>
