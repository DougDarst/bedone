import { NO_FILTERS, type Filters, type Scope } from '../list';
import { PRIORITIES, type Priority } from '../types';

const KEY = 'filters';

function load(): Filters {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Filters> | null;
    const scope: Scope = saved?.scope === 'today' || saved?.scope === 'week' ? saved.scope : 'all';
    const priorities = Array.isArray(saved?.priorities)
      ? PRIORITIES.filter((p) => saved.priorities!.includes(p))
      : [];
    return { scope, priorities };
  } catch {
    return { ...NO_FILTERS };
  }
}

/** Task list filters, remembered per device. */
class FilterState {
  value = $state<Filters>(load());

  setScope(scope: Scope): void {
    this.value = { ...this.value, scope };
    this.#save();
  }

  togglePriority(priority: Priority): void {
    const has = this.value.priorities.includes(priority);
    const priorities = PRIORITIES.filter((p) => (p === priority ? !has : this.value.priorities.includes(p)));
    this.value = { ...this.value, priorities };
    this.#save();
  }

  #save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      // not remembered
    }
  }
}

export const filters = new FilterState();
