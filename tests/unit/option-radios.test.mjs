import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../legacy-editor-package.js';
import {validateSystemPackage} from '../../js/validation/schemas.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {nodeSchema,resolveSchema} from '../../js/editor/form-metadata.js';

function example(presentation) {
  const pkg=minimalPackage('choices');pkg.system.characterTemplate.items=[{id:'one',name:'Recurso',when:''}];
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'list',field:'items',label:'Recursos',itemSchema:{name:'text',when:{type:'select',presentation,label:'Recuperação',options:[{value:'',label:'Ajuste manual'},{value:'pause',label:'Pausa'},{value:'rest',label:'Repouso'}]}}});
  return pkg;
}
test('radios e alias antigo validam a mesma escolha textual, sem converter dados durante preparação',()=>{
  for(const mode of ['radios','checkboxes']){
    const pkg=example(mode),before=structuredClone(pkg);
    assert.deepEqual(validateSystemPackage(pkg),[]);
    const result=prepareDocument(pkg,{kind:'package'});assert.equal(result.status,'ready');assert.deepEqual(result.document,before);assert.deepEqual(pkg,before);
  }
  const schema=nodeSchema('component',{type:'list'}),field=resolveSchema(schema.itemSchema.values,{type:'select'});
  assert.ok(field.properties.presentation.enum.includes('radios'));
});
test('uma escolha exclusiva exige opções distintas, valor textual e alternativa manual explícita',()=>{
  for(const edit of [f=>f.presentation='other',f=>f.type='number',f=>f.valueType='number',f=>f.options.pop()&&f.options.push(f.options[0]),f=>f.options.shift()]){
    const pkg=example('radios');edit(pkg.layouts[0].tabs[0].sections[0].containers[0].components.at(-1).itemSchema.when);
    assert.ok(validateSystemPackage(pkg).length);
  }
});
