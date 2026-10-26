import type { DndEvent, Item } from 'svelte-dnd-action';

// Events dispatched by svelte-dnd-action's `dndzone` action.
declare module 'svelte/elements' {
  interface HTMLAttributes<T> {
    onconsider?: (event: CustomEvent<DndEvent<Item>> & { currentTarget: EventTarget & T }) => void;
    onfinalize?: (event: CustomEvent<DndEvent<Item>> & { currentTarget: EventTarget & T }) => void;
  }
}

export {};
