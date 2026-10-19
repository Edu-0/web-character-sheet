// Preferências de apresentação; não integram sistema, layout ou personagem.
export const BACKGROUND_MODES = ['solid', 'translucent', 'browser'];

export function normalizeMaterialPreferences(value = {}) {
  return {
    backgroundMode: BACKGROUND_MODES.includes(value?.backgroundMode) ? value.backgroundMode : 'solid',
    reduceTransparency: value?.reduceTransparency === true,
  };
}

export function materialAttributes(value, systemReduced = false) {
  const preferences = normalizeMaterialPreferences(value);
  return {background: preferences.backgroundMode, materialEffects: preferences.reduceTransparency || systemReduced ? 'off' : 'on'};
}

export function previewMaterialAttributes(value = {}) {
  const background = BACKGROUND_MODES.includes(value?.background) ? value.background : 'solid';
  // O iframe conserva fundo próprio. A transparência externa pertence à página.
  return {background: background === 'browser' ? 'solid' : background, materialEffects: value?.materialEffects === 'off' ? 'off' : 'on'};
}
