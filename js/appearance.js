import { applyPalette, applyTheme, getAvailablePalettes, getAvailableThemes } from './theme.js';

export function initAppearanceControls() {
  const tabs = [...document.querySelectorAll('.appearance-tabs [role="tab"]')];
  const activate = (index, focus = false) => tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(index === i));
    tab.tabIndex = index === i ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = index !== i;
    if (index === i && focus) tab.focus();
  });
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', event => {
      const next = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[event.key];
      if (next != null) { event.preventDefault(); activate(next, true); }
    });
  });
  const mode = document.getElementById('appearance-mode');
  const palettes = document.getElementById('appearance-palettes');
  getAvailableThemes().forEach((theme) => {
    const option = document.createElement('option');
    option.value = theme.key;
    option.textContent = theme.label;
    mode.appendChild(option);
  });
  mode.addEventListener('change', () => applyTheme(mode.value));
  getAvailablePalettes().forEach((palette) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `palette-choice palette-choice--${palette.key}`;
    button.dataset.paletteChoice = palette.key;
    const preview = document.createElement('span');
    preview.className = 'palette-choice__preview';
    preview.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) preview.appendChild(document.createElement('span'));
    const label = document.createElement('strong');
    label.textContent = palette.label;
    const description = document.createElement('span');
    description.className = 'palette-choice__description';
    description.textContent = palette.description;
    button.append(preview, label, description);
    button.addEventListener('click', () => applyPalette(palette.key));
    palettes.appendChild(button);
  });
  function refresh() {
    mode.value = document.documentElement.dataset.theme;
    palettes.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === document.documentElement.dataset.palette)));
  }
  document.addEventListener('appearance:change', refresh);
  refresh();
}
