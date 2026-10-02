import { loadSettings, saveSettings } from './storage.js';
import { createDiceLabel } from './dice-display.js';
import { ORNAMENTS, ORNAMENT_FAMILIES, ORNAMENT_POSITIONS, ORNAMENT_PRESETS } from '../assets/artwork/ornaments.js';

const INITIAL_ARTWORK = { enabled: false, intensity: 'soft', preset: 'custom', selected: [{ id: 'dice-orbit', position: 'right' }] };
const $ = (id) => document.getElementById(id);

export function normalizeArtwork(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const selected = [];
  for (const item of Array.isArray(source.selected) ? source.selected : INITIAL_ARTWORK.selected) {
    if (!item || !ORNAMENTS.some((art) => art.id === item.id) || !ORNAMENT_POSITIONS.some((position) => position.id === item.position)) continue;
    if (selected.some((art) => art.id === item.id || art.position === item.position)) continue;
    selected.push({ id: item.id, position: item.position });
  }
  return {
    enabled: source.enabled === true,
    intensity: ['subtle', 'soft', 'strong'].includes(source.intensity) ? source.intensity : 'soft',
    preset: ORNAMENT_PRESETS.some((preset) => preset.id === source.preset) ? source.preset : 'custom',
    selected,
  };
}

export function getArtworkPreferences() {
  const settings = loadSettings();
  return { artwork: normalizeArtwork(settings.artwork), diceDisplay: settings.diceDisplay === 'illustrated' ? 'illustrated' : 'text' };
}

export function applyArtworkPreferences({ artwork, diceDisplay } = {}) {
  const settings = loadSettings();
  settings.artwork = normalizeArtwork(artwork ?? settings.artwork);
  settings.diceDisplay = (diceDisplay ?? settings.diceDisplay) === 'illustrated' ? 'illustrated' : 'text';
  saveSettings(settings);
  document.documentElement.dataset.diceDisplay = settings.diceDisplay;
  document.documentElement.dataset.ornamentsEnabled = String(settings.artwork.enabled);
  document.dispatchEvent(new Event('artwork:change'));
  return { artwork: settings.artwork, diceDisplay: settings.diceDisplay };
}

export function createOrnament(art) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 240 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  // Somente desenhos do catálogo local; settings nunca fornece markup ou URLs.
  svg.innerHTML = art.drawing;
  return svg;
}

function renderComposition(host, artwork, { preview = false } = {}) {
  host.replaceChildren();
  host.dataset.intensity = artwork.intensity;
  host.hidden = !artwork.selected.length || (!preview && !artwork.enabled);
  for (const position of ORNAMENT_POSITIONS) {
    const slot = document.createElement('div');
    slot.className = 'sheet-ornaments__slot';
    slot.dataset.position = position.id;
    const selected = artwork.selected.find((item) => item.position === position.id);
    const art = selected && ORNAMENTS.find((item) => item.id === selected.id);
    if (art) { slot.dataset.ornament = art.id; slot.appendChild(createOrnament(art)); }
    host.appendChild(slot);
  }
}

export function initArtworkControls() {
  const cards = new Map();
  const notice = $('ornament-notice');
  function update(patch, message = '') {
    applyArtworkPreferences({ artwork: { ...getArtworkPreferences().artwork, ...patch } });
    notice.textContent = message;
  }
  function place(art, position) {
    const previous = getArtworkPreferences().artwork;
    const displaced = previous.selected.find((item) => item.position === position && item.id !== art.id);
    const selected = previous.selected.filter((item) => item.id !== art.id && item.position !== position);
    selected.push({ id: art.id, position });
    const displacedName = ORNAMENTS.find((item) => item.id === displaced?.id)?.label;
    update({ selected, preset: 'custom' }, displacedName ? `${displacedName} deu lugar a ${art.label} nessa posição.` : 'Combinação atualizada.');
  }
  for (const family of ORNAMENT_FAMILIES) {
    const group = document.createElement('details');
    group.className = 'ornament-family';
    group.dataset.family = family.id;
    const legend = document.createElement('summary');
    legend.textContent = family.label;
    group.appendChild(legend);
    const grid = document.createElement('div');
    grid.className = 'ornament-choices';
    for (const art of ORNAMENTS.filter((item) => item.family === family.id)) {
      const card = document.createElement('div');
      card.className = 'ornament-choice';
      const preview = document.createElement('div');
      preview.className = 'ornament-choice__preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.appendChild(createOrnament(art));
      const label = document.createElement('label');
      label.className = 'ornament-choice__label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', `Usar ${art.label}`);
      label.append(input, document.createTextNode(art.label));
      const position = document.createElement('select');
      position.setAttribute('aria-label', `Posição de ${art.label}`);
      for (const item of ORNAMENT_POSITIONS) {
        const option = document.createElement('option');
        option.value = item.id; option.textContent = item.label; position.appendChild(option);
      }
      input.addEventListener('change', () => {
        if (input.checked) {
          const occupied = new Set(getArtworkPreferences().artwork.selected.map((item) => item.position));
          const destination = !occupied.has(art.position) ? art.position : ORNAMENT_POSITIONS.find((item) => !occupied.has(item.id))?.id || art.position;
          place(art, destination);
        } else update({ selected: getArtworkPreferences().artwork.selected.filter((item) => item.id !== art.id), preset: 'custom' }, 'Combinação atualizada.');
      });
      position.addEventListener('change', () => place(art, position.value));
      card.append(preview, label, position); grid.appendChild(card);
      cards.set(art.id, { input, position, card, art });
    }
    group.appendChild(grid); $('ornament-families').appendChild(group);
  }
  for (const preset of ORNAMENT_PRESETS) {
    const option = document.createElement('option'); option.value = preset.id; option.textContent = preset.label; $('ornament-preset').appendChild(option);
  }
  $('ornament-enabled').addEventListener('change', (event) => update({ enabled: event.target.checked }, event.target.checked ? 'Ornamentos ativados.' : 'Ornamentos ocultos; sua combinação foi preservada.'));
  $('ornament-intensity').addEventListener('change', (event) => update({ intensity: event.target.value }));
  $('ornament-preset').addEventListener('change', (event) => {
    const preset = ORNAMENT_PRESETS.find((item) => item.id === event.target.value);
    if (preset) update({ selected: preset.selected, preset: preset.id, enabled: true }, `Combinação ${preset.label} aplicada.`);
    else update({ preset: 'custom' });
  });
  $('dice-display-mode').addEventListener('change', (event) => applyArtworkPreferences({ diceDisplay: event.target.value }));
  $('dice-display-preview').appendChild(createDiceLabel([6, 8]));
  function refresh() {
    const { artwork, diceDisplay } = getArtworkPreferences();
    $('ornament-enabled').checked = artwork.enabled;
    $('ornament-intensity').value = artwork.intensity;
    $('ornament-preset').value = artwork.preset;
    $('dice-display-mode').value = diceDisplay;
    for (const { input, position, card, art } of cards.values()) {
      const selected = artwork.selected.find((item) => item.id === art.id);
      input.checked = Boolean(selected);
      position.disabled = !selected;
      position.value = selected?.position || art.position;
      card.classList.toggle('ornament-choice--selected', Boolean(selected));
    }
    renderComposition($('sheet-ornaments'), artwork);
    document.querySelectorAll('.ornament-family').forEach(group => {
      const family = ORNAMENT_FAMILIES.find(item => item.id === group.dataset.family);
      const names = artwork.selected.map(item => ORNAMENTS.find(art => art.id === item.id)).filter(art => art.family === family.id).map(art => art.label);
      group.querySelector('summary').textContent = `${family.label} · ${names.length ? names.join(', ') : 'nenhuma selecionada'}`;
    });
    renderComposition($('ornament-preview'), artwork, { preview: true });
    $('ornament-preview-state').textContent = !artwork.selected.length ? 'Nenhuma arte selecionada.' : artwork.enabled ? 'Esta combinação aparece no topo da ficha.' : 'Prévia da combinação guardada. Ative os ornamentos para exibi-la na ficha.';
  }
  document.addEventListener('artwork:change', refresh);
  applyArtworkPreferences();
}
