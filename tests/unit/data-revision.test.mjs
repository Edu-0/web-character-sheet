import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {initializeData} from '../../js/engine/data-definitions.js';
import {systemDataRevision} from '../../js/engine/data-revision.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {planDataMigration} from '../../js/migrations/data-migration-plan.js';
import {installationPlan} from '../../js/repositories/package-installation.js';
test('AV-11 revisão de bindings é opt-in v3; leitura/importação não carimba documento antigo',()=>{
 const pkg=minimalPackage('binding-revision'),character={schemaVersion:1,meta:{id:'old',system:pkg.system.id},extra:{zero:0,nil:null}};assert.equal(prepareDocument(character,{kind:'character',pkg}).status,'ready');pkg.system.dataRevision=2;const before=structuredClone(character);assert.equal(prepareDocument(character,{kind:'character',pkg}).status,'invalid');assert.deepEqual(character,before);
 const created=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate));assert.equal(created.meta.systemDataRevision,2);assert.equal(created.schemaVersion,1);created.meta.id='new';assert.equal(prepareDocument(created,{kind:'character',pkg}).status,'ready');
 for(const version of [1,2]){const legacy={schemaVersion:version,dataRevision:'metadado legado'};assert.equal(systemDataRevision(legacy),1);assert.deepEqual(initializeData(legacy,{}),{});}
});
test('AV-11 metadado ausente, null, futuro e inválido permanecem distintos do binding atual',()=>{
 const pkg=minimalPackage('binding-version');pkg.system.dataRevision=2;const character={schemaVersion:3,meta:{id:'hero',system:pkg.system.id}};
 for(const value of [null,0,'2',3,Infinity]){character.meta.systemDataRevision=value;assert.notEqual(prepareDocument(character,{kind:'character',pkg}).status,'ready');}
 character.meta.systemDataRevision=2;assert.equal(prepareDocument(character,{kind:'character',pkg}).status,'ready');delete character.meta.systemDataRevision;assert.equal(prepareDocument(character,{kind:'character',pkg}).status,'invalid');
 for(const value of [null,0,1.5,1000001]){pkg.system.dataRevision=value;assert.equal(prepareDocument(pkg,{kind:'package'}).status,'invalid');}
});
test('AV-11 migração carimba todos os vinculados sem aumentar schemaVersion e bloqueia colisão de metadado',()=>{
 const base=minimalPackage('revision-migration'),candidate=structuredClone(base),character={schemaVersion:2,meta:{id:'hero',system:base.system.id},extra:false},spec={version:1,steps:[],retired:[]};candidate.system.dataRevision=2;
 const plan=installationPlan({candidate,base,currentPackage:base,characters:[character],migration:spec});assert.equal(plan.migration.characters[0].after.meta.systemDataRevision,2);assert.equal(plan.migration.characters[0].after.schemaVersion,2);assert.equal(character.meta.systemDataRevision,undefined);
 character.meta.systemDataRevision='metadado anterior';assert.equal(planDataMigration({base,candidate,characters:[character],spec}).status,'blocked');const resolved=planDataMigration({base,candidate,characters:[character],spec:{...spec,replaceRevisionMetadata:true}});assert.equal(resolved.status,'ready');assert.equal(resolved.sourceCharacters[0].meta.systemDataRevision,'metadado anterior');assert.equal(resolved.characters[0].after.meta.systemDataRevision,2);
 for(const revision of [1,3]){candidate.system.dataRevision=revision;assert.throws(()=>installationPlan({candidate,base,currentPackage:base,characters:[{...character,meta:{id:'hero',system:base.system.id}}],migration:spec}),/incrementada/);}
});
