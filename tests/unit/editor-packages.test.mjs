import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copyPackage} from '../../js/editor/package-commands.js';
import {knownReferences,identityImpact} from '../../js/editor/references.js';
import {validateText} from '../../js/editor/validation.js';
import {EditorSession} from '../../js/editor/session.js';
test('cópia preserva extras e troca somente vínculos de identidade definidos',()=>{
  const pkg=JSON.parse(readFileSync('data/examples/generic-entry-rolls.package.json','utf8'));pkg.extra={id:pkg.system.id,off:false,zero:0,empty:'',nil:null};pkg.layouts.push({...structuredClone(pkg.layouts[0]),id:'second'});
  const copy=copyPackage(pkg,'copy-test');assert.equal(copy.system.characterTemplate.meta.system,'copy-test');assert.ok(copy.layouts.every(layout=>layout.system==='copy-test'));assert.deepEqual(copy.extra,pkg.extra);assert.deepEqual(copy.system.entryRolls,pkg.system.entryRolls);assert.equal(validateText(JSON.stringify(copy)).status,'ready');
  const refs=knownReferences(copy);assert.ok(refs.some(entry=>entry.kind==='rollPreset'));assert.ok(!refs.some(entry=>entry.pointer.startsWith('/extra')));
  copy.layouts.pop();assert.deepEqual(identityImpact(pkg,copy).removedLayouts,['second']);
});
test('normalização é explícita/desfazível e mantém original baixável após recuperação',()=>{
  const pkg=JSON.parse(readFileSync('data/examples/generic-entry-rolls.package.json','utf8'));
  const preset=pkg.system.entryRolls.skillCheck;preset.test=preset.check;delete preset.check;
  const text=JSON.stringify(pkg),session=new EditorSession({text});assert.equal(session.validation.status,'needsMigration');assert.equal(session.lastValid,null);
  session.normalize();assert.equal(session.validation.status,'ready');assert.equal(session.recoveryOriginalText,text);session.replay('undo');assert.equal(session.text,text);assert.equal(session.lastValid.revision,1);
  const restored=new EditorSession(session.envelope());assert.equal(restored.recoveryOriginalText,text);
});

test('relatório cobre expressões, fontes de variáveis, presets e overrides sem interpretar extras',()=>{
  const pkg={system:{id:'refs',characterTemplate:{meta:{system:'refs'}},formulas:{'total/~':'base + bonus'},checks:{hit:{sourceId:'skill',field:'skills'}}},layouts:[{id:'one',system:'refs',components:[{type:'computed',formula:'total/~',variables:{bonus:{system:'bonuses.score'},base:{field:'score'}},presetsFrom:'presets',traitsFrom:'traits',overrideKeys:{weight:'weight.total'},extra:{field:'opaque',variables:{bonus:{system:'opaque'}}}}]}]};
  const refs=knownReferences(pkg),byPointer=new Map(refs.map(entry=>[entry.pointer,entry.value]));
  for(const [pointer,value]of [['/system/formulas/total~1~0','base + bonus'],['/layouts/0/components/0/variables/bonus/system','bonuses.score'],['/layouts/0/components/0/variables/base/field','score'],['/layouts/0/components/0/presetsFrom','presets'],['/layouts/0/components/0/traitsFrom','traits'],['/layouts/0/components/0/overrideKeys/weight','weight.total'],['/system/checks/hit/sourceId','skill']])assert.equal(byPointer.get(pointer),value);
  assert.ok(!refs.some(entry=>entry.pointer.includes('/extra/')));
  const changed=structuredClone(pkg);changed.system.formulas['total/~']='base';changed.layouts[0].components[0].variables.bonus.system='bonuses.other';assert.equal(identityImpact(pkg,changed).changedReferences.length,2);assert.deepEqual(knownReferences({system:{id:'unknown',formulas:'opaque'},layouts:[]}).filter(entry=>entry.kind==='expression'),[]);
});
