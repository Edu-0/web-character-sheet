import test from 'node:test';
import assert from 'node:assert/strict';
import {PALETTES} from '../../js/data.js';
import {ORNAMENTS,ORNAMENT_FAMILIES,ORNAMENT_POSITIONS,ORNAMENT_PRESETS} from '../../assets/artwork/ornaments.js';

test('paletas e combinações temáticas apontam para artes locais completas sem IDs ou posições duplicadas',()=>{
  for(const [items,key] of [[PALETTES,'key'],[ORNAMENTS,'id'],[ORNAMENT_FAMILIES,'id'],[ORNAMENT_PRESETS,'id']])assert.equal(new Set(items.map(item=>item[key])).size,items.length);
  assert.equal(PALETTES.length,17);assert.equal(ORNAMENTS.length,36);
  for(const palette of PALETTES.filter(item=>item.ornamentPreset)){
    const preset=ORNAMENT_PRESETS.find(item=>item.id===palette.ornamentPreset);assert.ok(preset);
    assert.equal(preset.selected.length,3);assert.equal(new Set(preset.selected.map(item=>item.position)).size,3);
    for(const chosen of preset.selected){
      const art=ORNAMENTS.find(item=>item.id===chosen.id);assert.ok(art);
      assert.equal(art.family,palette.key);assert.ok(ORNAMENT_POSITIONS.some(item=>item.id===chosen.position));
    }
  }
  for(const art of ORNAMENTS){
    assert.ok(ORNAMENT_FAMILIES.some(item=>item.id===art.family));
    assert.doesNotMatch(art.drawing,/<(?:script|foreignObject|image|use|style|defs)\b|\bon\w+\s*=|\b(?:id|href)\s*=|url\(|https?:/i);
  }
});
