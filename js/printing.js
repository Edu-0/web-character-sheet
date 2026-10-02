import { buildPrintSheet } from './engine/print-sheet.js';
import { getArtworkPreferences } from './artwork.js';
import { loadSettings, saveSettings } from './storage.js';
import { normalizePrintProfile } from './engine/print-profile.js';

function applyPaperPalette(host) {
  // Reutiliza a paleta existente em sua versão clara, sem mudar tema/preferências.
  const sample = document.createElement('span');
  sample.hidden = true;
  sample.dataset.palette = document.documentElement.dataset.palette || 'classic';
  sample.dataset.theme = 'light';
  document.body.append(sample);
  const style = getComputedStyle(sample);
  for (const [paper, screen] of Object.entries({ ink: 'text', muted: 'text-muted', accent: 'accent-strong', line: 'border', tint: 'panel-alt', wash: 'bg' })) {
    host.style.setProperty(`--paper-${paper}`, style.getPropertyValue(`--color-${screen}`).trim());
  }
  sample.remove();
}

// beforeprint cobre o botão, Ctrl/Cmd+P e o comando do navegador.
export function initPrinting(getCurrent) {
  const trigger = document.getElementById('btn-print');
  const dialog = document.getElementById('print-options');
  trigger.addEventListener('click', () => {
    const profile = normalizePrintProfile(loadSettings().printProfile);
    dialog.querySelector(`input[value="${profile}"]`).checked = true;
    dialog.showModal();
  });
  document.getElementById('print-options-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    (trigger.getClientRects().length ? trigger : document.getElementById('btn-more')).focus();
  });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const printProfile = normalizePrintProfile(new FormData(event.target).get('print-profile'));
    saveSettings({ ...loadSettings(), printProfile });
    dialog.close();
    window.print();
  });
  const host = document.createElement('div');
  host.id = 'print-root'; host.hidden = true;
  document.body.append(host);
  const pageIdentity = document.createElement('style');
  pageIdentity.media = 'print';
  document.head.append(pageIdentity);
  const prepare = () => {
    const current = getCurrent();
    host.replaceChildren();
    pageIdentity.textContent = '';
    if (!current) { host.textContent = 'Nenhum personagem aberto.'; return; }
    applyPaperPalette(host);
    const printProfile = normalizePrintProfile(loadSettings().printProfile);
    host.append(buildPrintSheet(current.layout, current.character, current.system, { ...getArtworkPreferences(), printProfile }));
    const name = current.character.identity?.name || current.character.name || 'Personagem sem nome';
    const identity = `${name.slice(0, 54)} · ${current.system.name}${printProfile === 'compact' ? ' · Compacta' : ''}`.replace(/\s+/g, ' ');
    pageIdentity.textContent = `@page { @bottom-left { content: "${CSS.escape(identity)}"; } }`;
  };
  window.addEventListener('beforeprint', prepare);
  window.addEventListener('afterprint', () => { host.replaceChildren(); pageIdentity.textContent = ''; });
  return prepare;
}
