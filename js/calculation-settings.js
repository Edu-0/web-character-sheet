import { loadSettings, saveSettings } from './storage.js';

// Preferência de apresentação: não modifica as exceções do personagem.
export function applyCalculationPreferences(enabled) {
  const settings = loadSettings();
  settings.showCalculationControls = (enabled ?? settings.showCalculationControls) === true;
  saveSettings(settings);
  document.documentElement.dataset.calculationControls = settings.showCalculationControls ? 'visible' : 'hidden';
  const checkbox = document.getElementById('show-calculation-controls');
  if (checkbox) checkbox.checked = settings.showCalculationControls;
  return settings.showCalculationControls;
}

export function initCalculationSettings() {
  applyCalculationPreferences();
  document.getElementById('show-calculation-controls').addEventListener('change', event => {
    applyCalculationPreferences(event.target.checked);
  });
}
