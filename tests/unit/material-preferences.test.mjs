import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMaterialPreferences,materialAttributes,previewMaterialAttributes} from '../../js/material-preferences.js';

test('preferências antigas/inválidas usam sólido e booleanos estritos, sem mudar a entrada',()=>{
  for(const value of [undefined,null,{},'browser',{backgroundMode:'invalid',reduceTransparency:'true'}])assert.deepEqual(normalizeMaterialPreferences(value),{backgroundMode:'solid',reduceTransparency:false});
  const preferences={backgroundMode:'browser',reduceTransparency:true,theme:'dark'};
  assert.deepEqual(normalizeMaterialPreferences(preferences),{backgroundMode:'browser',reduceTransparency:true});
  assert.deepEqual(preferences,{backgroundMode:'browser',reduceTransparency:true,theme:'dark'});
});
test('redução manual e do dispositivo desativam efeitos sem apagar o modo escolhido',()=>{
  for(const backgroundMode of ['solid','translucent','browser']){
    assert.deepEqual(materialAttributes({backgroundMode}),{background:backgroundMode,materialEffects:'on'});
    assert.deepEqual(materialAttributes({backgroundMode},true),{background:backgroundMode,materialEffects:'off'});
    assert.deepEqual(materialAttributes({backgroundMode,reduceTransparency:true}),{background:backgroundMode,materialEffects:'off'});
  }
});
test('a prévia tem fundo próprio e valida materiais sem depender de storage ou do sistema',()=>{
  for(const background of ['solid','translucent','browser'])assert.deepEqual(previewMaterialAttributes({background,materialEffects:'off'}),{background:background==='browser'?'solid':background,materialEffects:'off'});
  for(const value of [undefined,null,{}, {background:'other',materialEffects:'invalid'}])assert.deepEqual(previewMaterialAttributes(value),{background:'solid',materialEffects:'on'});
});
