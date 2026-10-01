// theme.js
// Sistema de temas via CSS custom properties + atributo data-theme no <html>.
import { THEMES, PALETTES } from './data.js';
import { saveSettings, loadSettings } from './storage.js';

const DEFAULT_THEME = 'dark';

export function getAvailableThemes() {
  return THEMES;
}

export function getAvailablePalettes() {
  return PALETTES;
}

export function applyPalette(paletteKey) {
  const valid = PALETTES.some((palette) => palette.key === paletteKey) ? paletteKey : 'classic';
  document.documentElement.setAttribute('data-palette', valid);
  const settings = loadSettings();
  settings.palette = valid;
  saveSettings(settings);
  document.dispatchEvent(new Event('appearance:change'));
  return valid;
}

export function applyTheme(themeKey) {
  const valid = THEMES.some((t) => t.key === themeKey) ? themeKey : DEFAULT_THEME;
  document.documentElement.setAttribute('data-theme', valid);
  const settings = loadSettings();
  settings.theme = valid;
  saveSettings(settings);
  document.dispatchEvent(new Event('appearance:change'));
  return valid;
}

export function initTheme() {
  const settings = loadSettings();
  applyPalette(settings.palette || 'classic');
  return applyTheme(settings.theme || DEFAULT_THEME);
}
