/* This preference applies only to Nalin's profile. */
(() => {
  'use strict';

  const root = document.documentElement;
  const themes = new Set(['paper', 'ember', 'violet', 'lagoon']);
  const storageKey = 'nalin-profile-theme';
  const defaultTheme = 'ember';
  let currentTheme = defaultTheme;

  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (themes.has(savedTheme)) currentTheme = savedTheme;
  } catch {
    // The theme chooser also works when browser storage is unavailable.
  }

  // Apply the saved palette before the stylesheets and page content load.
  root.dataset.theme = currentTheme;

  const initialize = () => {
    const picker = document.querySelector('.nd-theme-picker');
    if (!picker) return;
    const buttons = picker.querySelectorAll('[data-theme-choice]');

    const applyTheme = (theme) => {
      if (!themes.has(theme)) return;
      currentTheme = theme;
      root.dataset.theme = theme;
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
      }
    };

    for (const button of buttons) {
      button.addEventListener('click', () => {
        const theme = button.dataset.themeChoice;
        applyTheme(theme);
        try {
          localStorage.setItem(storageKey, currentTheme);
        } catch {
          // Keep the current visit usable even when persistence is blocked.
        }
      });
    }

    window.addEventListener('storage', (event) => {
      if (event.key === storageKey || event.key === null) {
        applyTheme(themes.has(event.newValue) ? event.newValue : defaultTheme);
      }
    });

    applyTheme(currentTheme);
    picker.hidden = false;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
