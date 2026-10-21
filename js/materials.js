import {loadSettings, saveSettings} from './storage.js';
import {normalizeMaterialPreferences, materialAttributes} from './material-preferences.js';
import {openModal} from './modal.js';

export function initMaterialControls() {
  const background = document.getElementById('appearance-background-mode');
  const reduce = document.getElementById('appearance-reduce-transparency');
  const tint = document.getElementById('appearance-glass-tint');
  const strength = document.getElementById('appearance-glass-strength');
  const status = document.getElementById('appearance-material-status');
  const system = matchMedia('(prefers-reduced-transparency: reduce)');
  const refresh = () => {
    const settings = normalizeMaterialPreferences(loadSettings());
    const attributes = materialAttributes(settings, system.matches);
    const highContrast = document.documentElement.dataset.palette === 'high-contrast';
    Object.assign(document.documentElement.dataset, attributes);
    background.value = settings.backgroundMode;
    reduce.checked = settings.reduceTransparency;
    tint.value = settings.glassTint;
    strength.value = settings.glassTintStrength;
    strength.disabled = settings.glassTint === 'neutral';
    document.getElementById('appearance-glass-controls').disabled = highContrast || settings.backgroundMode === 'solid' || attributes.materialEffects === 'off';
    status.textContent = highContrast
      ? 'Alto contraste usa superfícies opacas e sem desfoque. Suas preferências de vidro permanecem salvas para as outras paletas.'
      : attributes.materialEffects === 'off'
      ? 'Efeitos reduzidos: superfícies opacas e desfoque desativado. Sua escolha de fundo permanece salva.'
      : settings.backgroundMode === 'mega'
        ? 'Mega translúcido: vidro mais intenso nas superfícies e nos botões secundários. Campos e ações principais mantêm a leitura estável.'
        : settings.backgroundMode === 'translucent'
          ? 'Vidro fosco nas janelas, menus e barras, sobre um fundo tonalizado da aplicação. Campos mantêm fundo próprio.'
          : 'Superfícies sólidas. O desfoque atrás das janelas pode continuar ativo; reduza os efeitos abaixo para desativá-lo.';
    document.dispatchEvent(new Event('materials:change'));
  };
  const save = () => {
    const settings = loadSettings();
    settings.backgroundMode = background.value;
    settings.reduceTransparency = reduce.checked;
    settings.glassTint = tint.value;
    settings.glassTintStrength = strength.value;
    saveSettings(settings);
    refresh();
  };
  background.addEventListener('change', save);
  reduce.addEventListener('change', save);
  tint.addEventListener('change', save);
  strength.addEventListener('change', save);
  system.addEventListener('change', refresh);
  document.addEventListener('appearance:change', refresh);
  document.getElementById('appearance-preview-open').addEventListener('click', () => {
    const content = document.createElement('div');
    const description = document.createElement('p');
    description.textContent = 'Esta janela usa o material selecionado. Os campos conservam fundo próprio para facilitar a leitura.';
    const label = document.createElement('label');
    label.className = 'field';
    const text = document.createElement('span');
    text.textContent = 'Campo de exemplo';
    const input = document.createElement('input');
    input.value = 'Passo lunar'; input.readOnly = true;
    label.append(text, input); content.append(description, label);
    openModal({title: 'Prévia do material', contentEl: content, actions: [{label: 'Fechar prévia', className: 'button button--primary'}]});
  });
  refresh();
}
