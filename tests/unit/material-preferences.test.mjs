import test from 'node:test';
import assert from 'node:assert/strict';
import {BACKGROUND_MODES,GLASS_TINTS,GLASS_TINT_STRENGTHS,normalizeMaterialPreferences,materialAttributes,previewMaterialAttributes} from '../../js/material-preferences.js';
const tintDefaults={glassTint:'palette',glassTintStrength:'medium'};

test('preferências antigas/inválidas usam sólido e booleanos estritos, sem mudar a entrada',()=>{
  for(const value of [undefined,null,{},'browser',{backgroundMode:'invalid',reduceTransparency:'true',glassTint:'url(https://invalid)',glassTintStrength:99}])assert.deepEqual(normalizeMaterialPreferences(value),{backgroundMode:'solid',reduceTransparency:false,...tintDefaults});
  const preferences={backgroundMode:'browser',reduceTransparency:true,theme:'dark'};
  assert.deepEqual(normalizeMaterialPreferences(preferences),{backgroundMode:'solid',reduceTransparency:true,...tintDefaults});
  assert.deepEqual(preferences,{backgroundMode:'browser',reduceTransparency:true,theme:'dark'});
  assert.deepEqual(BACKGROUND_MODES,['solid','translucent','mega']);
  assert.deepEqual(materialAttributes(preferences),{background:'solid',materialEffects:'off',...tintDefaults});
});
test('redução manual e do dispositivo desativam efeitos sem apagar o modo escolhido',()=>{
  for(const backgroundMode of BACKGROUND_MODES){
    assert.deepEqual(materialAttributes({backgroundMode}),{background:backgroundMode,materialEffects:'on',...tintDefaults});
    assert.deepEqual(materialAttributes({backgroundMode},true),{background:backgroundMode,materialEffects:'off',...tintDefaults});
    assert.deepEqual(materialAttributes({backgroundMode,reduceTransparency:true}),{background:backgroundMode,materialEffects:'off',...tintDefaults});
  }
});
test('a prévia tem fundo próprio e valida materiais sem depender de storage ou do sistema',()=>{
  for(const background of [...BACKGROUND_MODES,'browser'])assert.deepEqual(previewMaterialAttributes({background,materialEffects:'off'}),{background:background==='browser'?'solid':background,materialEffects:'off',...tintDefaults});
  for(const value of [undefined,null,{}, {background:'other',materialEffects:'invalid'}])assert.deepEqual(previewMaterialAttributes(value),{background:'solid',materialEffects:'on',...tintDefaults});
});
test('tinturas são enumerações locais e sobrevivem à redução e à prévia sem mudar a entrada',()=>{
  for(const glassTint of GLASS_TINTS)for(const glassTintStrength of GLASS_TINT_STRENGTHS){
    const settings={backgroundMode:'mega',reduceTransparency:true,glassTint,glassTintStrength},before=structuredClone(settings);
    assert.deepEqual(normalizeMaterialPreferences(settings),settings);
    const attrs=materialAttributes(settings);
    assert.deepEqual(attrs,{background:'mega',materialEffects:'off',glassTint,glassTintStrength});
    assert.deepEqual(previewMaterialAttributes(attrs),attrs);assert.deepEqual(settings,before);
  }
});
