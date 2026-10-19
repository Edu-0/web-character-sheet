import {loadSettings, saveSettings} from './storage.js';
import {normalizeMaterialPreferences, materialAttributes} from './material-preferences.js';

export function initMaterialControls() {
  const background = document.getElementById('appearance-background-mode');
  const reduce = document.getElementById('appearance-reduce-transparency');
  const status = document.getElementById('appearance-material-status');
  const browserHint = document.getElementById('appearance-browser-hint');
  const system = matchMedia('(prefers-reduced-transparency: reduce)');
  const refresh = () => {
    const settings = normalizeMaterialPreferences(loadSettings());
    const attributes = materialAttributes(settings, system.matches);
    Object.assign(document.documentElement.dataset, attributes);
    background.value = settings.backgroundMode;
    reduce.checked = settings.reduceTransparency;
    browserHint.hidden = settings.backgroundMode !== 'browser';
    background.setAttribute('aria-describedby', browserHint.hidden
      ? 'appearance-material-status'
      : 'appearance-browser-hint appearance-material-status');
    status.textContent = attributes.materialEffects === 'off'
      ? 'Efeitos reduzidos: superfícies opacas e desfoque desativado. Sua escolha de fundo permanece salva.'
      : settings.backgroundMode === 'browser'
        ? 'A página permite transparência. O efeito externo depende da configuração do navegador; a prévia da ficha mantém fundo próprio.'
        : settings.backgroundMode === 'translucent'
          ? 'Translucidez interna sobre um fundo da aplicação. Campos e áreas de leitura conservam fundos estáveis.'
          : 'Fundo sólido. Menus e janelas usam materiais discretos; você pode reduzir os efeitos abaixo.';
    document.dispatchEvent(new Event('materials:change'));
  };
  const save = () => {
    const settings = loadSettings();
    settings.backgroundMode = background.value;
    settings.reduceTransparency = reduce.checked;
    saveSettings(settings);
    refresh();
  };
  background.addEventListener('change', save);
  reduce.addEventListener('change', save);
  system.addEventListener('change', refresh);
  document.addEventListener('appearance:change', refresh);
  refresh();
}
