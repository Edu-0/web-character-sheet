// theme.js
// Sistema de temas via CSS custom properties + atributo data-theme no <html>.
import { THEMES } from './data.js';
import { saveSettings, loadSettings } from './storage.js';

const DEFAULT_THEME = 'dark';

export function getAvailableThemes() {
  return THEMES;
}

export function applyTheme(themeKey) {
  const valid = THEMES.some((t) => t.key === themeKey) ? themeKey : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', valid);
  const settings = loadSettings();
  settings.theme = valid;
  saveSettings(settings);
  return valid;
}

export function initTheme() {
  const settings = loadSettings();
  return applyTheme(settings.theme || DEFAULT_THEME);
}
