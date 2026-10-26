export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme';

function load(): ThemePreference {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable (e.g. private mode): fall back to the system setting
  }
  return 'system';
}

/** Light/dark theme: follows the system unless overridden from the menu. Remembered per device. */
class Theme {
  preference = $state<ThemePreference>(load());

  set(preference: ThemePreference): void {
    this.preference = preference;
    try {
      if (preference === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, preference);
    } catch {
      // not remembered, but still applied for this visit
    }
    this.apply();
  }

  apply(): void {
    const root = document.documentElement;
    if (this.preference === 'system') delete root.dataset.theme;
    else root.dataset.theme = this.preference;
  }
}

export const theme = new Theme();
