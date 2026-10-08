import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {installationPlan} from '../../js/repositories/package-installation.js';
test('plano protege embutidos, ausência/base completa e caracteres vinculados',()=>{
  const pkg=minimalPackage('install-test'),character={...structuredClone(pkg.system.characterTemplate),meta:{system:pkg.system.id,id:'linked'}};
  assert.throws(()=>installationPlan({candidate:pkg,builtinIds:['install-test']}),/embutido/);
  assert.throws(()=>installationPlan({candidate:pkg,base:null,currentPackage:pkg}),/mudou/);
  const changed=structuredClone(pkg);changed.extra={zero:0};assert.throws(()=>installationPlan({candidate:pkg,base:pkg,currentPackage:changed}),/mudou/);
  assert.throws(()=>installationPlan({candidate:pkg,base:pkg,currentPackage:pkg,unavailableLinked:true}),/indisponível/);
  assert.throws(()=>installationPlan({candidate:pkg,base:pkg,currentPackage:pkg,unavailableUnidentified:true}),/sem identificação/);
  const future=structuredClone(pkg);future.schemaVersion=99;assert.throws(()=>installationPlan({candidate:pkg,base:future,currentPackage:future}),/não suportada/);
  const bad=structuredClone(character);bad.score='2';assert.throws(()=>installationPlan({candidate:pkg,base:pkg,currentPackage:pkg,characters:[bad]}),/character.score/);
  const plan=installationPlan({candidate:pkg,base:pkg,currentPackage:pkg,characters:[character]});assert.deepEqual(plan.linkedIds,['linked']);assert.equal(plan.replace,true);
});
