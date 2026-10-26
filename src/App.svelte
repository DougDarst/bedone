<script lang="ts">
  import './app.css';
  import { onMount } from 'svelte';
  import Login from './components/Login.svelte';
  import OfflineScreen from './components/OfflineScreen.svelte';
  import TaskListScreen from './components/TaskListScreen.svelte';
  import { connection } from './lib/state/connection.svelte';
  import { session } from './lib/state/session.svelte';
  import { theme } from './lib/state/theme.svelte';

  theme.apply();

  onMount(() => {
    connection.start();
    session.refresh().catch(() => connection.markOffline());
  });
</script>

<div class="app" inert={!connection.online}>
  {#if session.user}
    <TaskListScreen />
  {:else}
    <Login />
  {/if}
</div>

{#if !connection.online}
  <OfflineScreen />
{/if}

<style>
  .app {
    min-height: 100dvh;
  }
</style>
