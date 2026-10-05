import {test} from 'node:test';
import assert from 'node:assert/strict';
import {referenceOutputs,buildReference} from '../../scripts/build-reference.mjs';
import {validateLayout} from '../../js/validation/schemas.js';
import {COMPONENT_CONTRACTS} from '../../js/validation/contracts.js';
test('referência reproduzível, exemplos reais e alteração de contrato detectável',async()=>{
  const one=await referenceOutputs(),two=await referenceOutputs();assert.equal(one.markdown,two.markdown);assert.equal(one.json,two.json);
  assert.ok(one.examples.includes('check-buttons.package.json'));assert.ok(!/docs\/private|docs\/references/.test(one.markdown+one.json));
  const changed=structuredClone(COMPONENT_CONTRACTS);changed.textarea.properties.rows.default=4;
  assert.notEqual((await referenceOutputs({components:changed})).markdown,one.markdown);
  await buildReference({check:true});
});
test('descritor de parâmetro é guardado pelo validador; extras não são removidos',()=>{
  const component={type:'textarea',field:'notes',rows:'3',extra:{zero:0,off:false}};
  const layout={schemaVersion:1,id:'test',system:'test',tabs:[{id:'test',label:'Test',sections:[{id:'test',containers:[{components:[component]}]}]}]};
  assert.ok(validateLayout(layout).some(issue=>issue.path.endsWith('.rows')));component.rows=3;
  assert.deepEqual(validateLayout(layout),[]);assert.deepEqual(component.extra,{zero:0,off:false});
});
