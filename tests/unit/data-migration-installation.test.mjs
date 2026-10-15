import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {prepareSystemInstallation,installSystemPackage,migrationRecoveryEntries,prepareSystemDataRestoration,migrationRecoveryOriginal} from '../../js/repositories/system-repository.js';
import {getCharacter,listCharacters} from '../../js/repositories/character-repository.js';
import {WRITE_PROTOCOL,flushLibraryWrites} from '../../js/write-coordinator.js';
const store=new Map();let fault,clientProtocol=WRITE_PROTOCOL;
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>{if(fault?.(key,value))throw new DOMException('Quota fictícia','QuotaExceededError');store.set(key,value);Object.defineProperty(localStorage,key,{value,enumerable:true,configurable:true});},removeItem:key=>{store.delete(key);delete localStorage[key];}};
Object.defineProperty(navigator,'locks',{value:{request:async(name,operation)=>operation({name})},configurable:true});
Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve({active:{postMessage:(message,ports)=>ports[0].postMessage({protocol:clientProtocol,safe:true})}})},configurable:true});
const systemsKey='ficha-rpg:v2:systems',indexKey='ficha-rpg:v2:characters:index',key=id=>'ficha-rpg:v2:characters:'+id;
function fixture(id){
 for(const name of [...store.keys()])localStorage.removeItem(name);fault=null;clientProtocol=WRITE_PROTOCOL;
 const base=minimalPackage(id);base.system.dataDefinitions=[{id:'balance',label:'Saldo',binding:'balance',type:'integer',required:false,nullable:false}];const candidate=structuredClone(base);candidate.system.dataRevision=2;candidate.system.dataDefinitions[0].binding='wallet';
 const character={schemaVersion:1,meta:{id:'hero-'+id,system:id,updatedAt:'2026-10-14T00:00:00.000Z'},balance:0,extra:{null:null,flag:false,empty:''}};
 localStorage.setItem(systemsKey,JSON.stringify([base]));localStorage.setItem(key(character.meta.id),JSON.stringify(character));localStorage.setItem(indexKey,JSON.stringify([{id:character.meta.id,system:id,name:'Sem nome',updatedAt:character.meta.updatedAt}]));
 const migration={version:1,steps:[{targetId:'balance',sourceIds:['balance'],conversion:'copy',preserveSource:false}],retired:[]};return {base,candidate,character,migration};
}
function records(){return [...store.entries()].filter(([name])=>name.startsWith('ficha-rpg:recovery:')).map(([,raw])=>JSON.parse(JSON.parse(raw).raw)).filter(value=>value.kind==='rpg-data-migration');}
test('AV-11 writer instala pacote/personagens/índice/recuperação juntos e conserva ativo não salvo',async()=>{
 const f=fixture('migration-atomic'),second={...structuredClone(f.character),meta:{...f.character.meta,id:'second'},balance:2},foreign={schemaVersion:1,meta:{id:'foreign',system:'other'},name:'Estrangeiro'};localStorage.setItem(key(second.meta.id),JSON.stringify(second));localStorage.setItem(key(foreign.meta.id),JSON.stringify(foreign));
 const active=structuredClone(f.character);active.extra.latest='edição em memória';const activeRaw=localStorage.getItem(key(active.meta.id)),foreignRaw=localStorage.getItem(key(foreign.meta.id)),plan=prepareSystemInstallation(f.candidate,{expectedBase:f.base,currentCharacter:active,migration:f.migration});const before=structuredClone(active);
 assert.equal(plan.migration.characters.length,2);await installSystemPackage(plan,{currentCharacter:active});assert.deepEqual(active,before);assert.equal(getCharacter(active.meta.id).wallet,0);assert.equal(getCharacter(second.meta.id).wallet,2);assert.equal(getCharacter(active.meta.id).extra.latest,'edição em memória');assert.equal(getCharacter(active.meta.id).schemaVersion,1);assert.equal(localStorage.getItem(key(foreign.meta.id)),foreignRaw);assert.equal(getCharacter(active.meta.id).balance,undefined);
 assert.deepEqual(new Set(listCharacters().map(row=>row.id)),new Set([active.meta.id,'second','foreign']));assert.equal(JSON.parse(localStorage.getItem(systemsKey))[0].system.dataDefinitions[0].binding,'wallet');
 const [record]=records();assert.deepEqual(record.beforePackage,f.base);assert.deepEqual(record.beforeCharacters.find(c=>c.meta.id===active.meta.id),before);assert.equal(record.beforeRawCharacters.find(c=>c.id===active.meta.id).raw,activeRaw);assert.equal(record.afterCharacters.find(c=>c.id===active.meta.id).raw,localStorage.getItem(key(active.meta.id)));assert.equal(localStorage.getItem('ficha-rpg:v2:storage-journal'),null);
});
test('AV-11 personagem novo ou candidato/escolha alterados depois da prévia invalidam aplicação',async()=>{
 for(const change of ['character','candidate','choice']){
  const f=fixture('migration-stale-'+change),plan=prepareSystemInstallation(f.candidate,{migration:f.migration});if(change==='character')localStorage.setItem(key('new'),JSON.stringify({...f.character,meta:{...f.character.meta,id:'new'}}));if(change==='candidate')plan.package.system.name='Outra revisão';if(change==='choice')plan.migration.spec.steps[0].preserveSource=true;
  const before=[...store.entries()];await assert.rejects(installSystemPackage(plan),/mudou|mudaram/);assert.deepEqual([...store.entries()],before);assert.equal(records().length,0);
 }
});
test('AV-11 quota reverte pacote, personagens e índice sem perder dados ou criar recuperação parcial',async()=>{
 const f=fixture('migration-quota'),plan=prepareSystemInstallation(f.candidate,{migration:f.migration}),before=new Map(store);fault=(name,value)=>name===key(f.character.meta.id)&&JSON.parse(value).wallet!==undefined;
 await assert.rejects(installSystemPackage(plan),/gravar a biblioteca/);fault=null;assert.deepEqual(new Map(store),before);assert.equal(localStorage.getItem('ficha-rpg:v2:storage-journal'),null);assert.equal(records().length,0);
 await installSystemPackage(plan);assert.equal(getCharacter(f.character.meta.id).wallet,0);assert.equal(records().length,1);
});
test('AV-11 cliente protocolo2 não autoriza migração e índice conserva indisponível de outro sistema',async()=>{
 const f=fixture('migration-client'),plan=prepareSystemInstallation(f.candidate,{migration:f.migration});assert.equal(WRITE_PROTOCOL,3);clientProtocol=2;const before=new Map(store);await assert.rejects(installSystemPackage(plan),/janela antiga/);assert.deepEqual(new Map(store),before);clientProtocol=WRITE_PROTOCOL;
 const unavailable={schemaVersion:99,meta:{id:'unavailable',system:'other'}};localStorage.setItem(key('unavailable'),JSON.stringify(unavailable));const reviewed=prepareSystemInstallation(f.candidate,{migration:f.migration});await flushLibraryWrites();await installSystemPackage(reviewed);assert.equal(localStorage.getItem(key('unavailable')),JSON.stringify(unavailable));assert.equal(JSON.parse(localStorage.getItem(indexKey)).find(row=>row.id==='unavailable').unavailable,true);
});
test('AV-11 restauração usa o mesmo writer, repõe dados/metadados e cria cópia do estado substituído',async()=>{
 const f=fixture('migration-restore');await installSystemPackage(prepareSystemInstallation(f.candidate,{migration:f.migration}));const [entry]=migrationRecoveryEntries();assert.equal(entry.available,true);const original=migrationRecoveryOriginal(entry.key);assert.deepEqual(original.beforeCharacters,[f.character]);
 const plan=prepareSystemDataRestoration(entry.key);assert.equal(plan.restoration.status,'ready');await installSystemPackage(plan);const restored=getCharacter(f.character.meta.id);assert.equal(restored.balance,0);assert.equal(Object.hasOwn(restored,'wallet'),false);assert.equal(Object.hasOwn(restored.meta,'systemDataRevision'),false);assert.deepEqual(restored.extra,f.character.extra);assert.deepEqual(JSON.parse(localStorage.getItem(systemsKey))[0],f.base);assert.equal(records().length,2);assert.equal(records()[1].restorationOf,original.id);
 const inverse=migrationRecoveryEntries().find(row=>row.id!==entry.id);await installSystemPackage(prepareSystemDataRestoration(inverse.key));assert.equal(getCharacter(f.character.meta.id).wallet,0);assert.equal(getCharacter(f.character.meta.id).meta.systemDataRevision,2);
});
test('AV-11 restauração bloqueia edição posterior, personagem novo e cópia alterada após revisar',async()=>{
 for(const change of ['edit','new','copy']){
  const f=fixture('migration-restore-'+change);await installSystemPackage(prepareSystemInstallation(f.candidate,{migration:f.migration}));const [entry]=migrationRecoveryEntries();let plan;
  if(change==='copy'){plan=prepareSystemDataRestoration(entry.key);localStorage.removeItem(entry.key);}else{const changed=getCharacter(f.character.meta.id);if(change==='edit')changed.wallet=5;else changed.meta.id='new-restoration';localStorage.setItem(key(changed.meta.id),JSON.stringify(changed));plan=prepareSystemDataRestoration(entry.key,{allowBlockedMigration:true});assert.equal(plan.restoration.status,'blocked');}
  const before=new Map(store);await assert.rejects(installSystemPackage(plan),/conflitos|cópia de recuperação/);assert.deepEqual(new Map(store),before);
 }
});
test('AV-11 cópia incompatível fica disponível como bruto e não produz plano de restauração',async()=>{
 const f=fixture('migration-bad-recovery');await installSystemPackage(prepareSystemInstallation(f.candidate,{migration:f.migration}));const [entry]=migrationRecoveryEntries(),envelope=JSON.parse(localStorage.getItem(entry.key)),record=JSON.parse(envelope.raw);record.schemaVersion=99;envelope.raw=JSON.stringify(record);localStorage.setItem(entry.key,JSON.stringify(envelope));const before=new Map(store);assert.equal(migrationRecoveryEntries()[0].available,false);assert.throws(()=>prepareSystemDataRestoration(entry.key),/incompatível/);assert.deepEqual(new Map(store),before);
});

test('AV-12 prévia assíncrona compartilha preflight e recusa biblioteca alterada durante a revisão',async()=>{
 const {previewSystemDataMigration}=await import('../../js/repositories/system-repository.js');const f=fixture('sliced-install');const plan=await previewSystemDataMigration(f.candidate,{migration:f.migration},{yieldTask:async()=>{}});assert.deepEqual(plan,prepareSystemInstallation(f.candidate,{migration:f.migration}));
 const before=localStorage.getItem(systemsKey);await assert.rejects(previewSystemDataMigration(f.candidate,{migration:f.migration},{onProgress:({completed,total})=>{if(completed===total)localStorage.setItem(key('new-during-review'),JSON.stringify({...f.character,meta:{...f.character.meta,id:'new-during-review'}}));},yieldTask:async()=>{}}),/biblioteca mudou/);assert.equal(localStorage.getItem(systemsKey),before);assert.equal(records().length,0);
});
