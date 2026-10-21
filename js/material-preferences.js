// Preferências de apresentação; não integram sistema, layout ou personagem.
export const BACKGROUND_MODES = ['solid', 'translucent', 'mega'];
export const GLASS_TINTS = ['palette', 'neutral', 'rose', 'azure', 'emerald', 'crimson', 'violet'];
export const GLASS_TINT_STRENGTHS = ['soft', 'medium', 'strong'];

export function normalizeMaterialPreferences(value = {}) {
  return {
    backgroundMode: BACKGROUND_MODES.includes(value?.backgroundMode) ? value.backgroundMode : 'solid',
    reduceTransparency: value?.reduceTransparency === true,
    glassTint: GLASS_TINTS.includes(value?.glassTint) ? value.glassTint : 'palette',
    glassTintStrength: GLASS_TINT_STRENGTHS.includes(value?.glassTintStrength) ? value.glassTintStrength : 'medium',
  };
}

export function materialAttributes(value, systemReduced = false) {
  const preferences = normalizeMaterialPreferences(value);
  return {background: preferences.backgroundMode, materialEffects: preferences.reduceTransparency || systemReduced ? 'off' : 'on', glassTint: preferences.glassTint, glassTintStrength: preferences.glassTintStrength};
}

export function previewMaterialAttributes(value = {}) {
  const preferences = normalizeMaterialPreferences({...value, backgroundMode: value?.background});
  return {background: preferences.backgroundMode, materialEffects: value?.materialEffects === 'off' ? 'off' : 'on', glassTint: preferences.glassTint, glassTintStrength: preferences.glassTintStrength};
}
