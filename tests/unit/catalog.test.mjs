import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validCatalogIds} from '../../js/validation/catalog.js';
import {validateLibraryBackup} from '../../js/validation/backup.js';
import {CATALOG_KEY,catalogInstallationIds,initializeCatalogInstallations,catalogInstallationsChange} from '../../js/repositories/catalog-installations.js';
import {transact,readRaw,readJson,transactWithinWrite} from '../../js/persistence.js';
import {withLibraryWrite,flushLibraryWrites} from '../../js/write-coordinator.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
const store=new Map();
globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>{store.set(key,value);Object.defineProperty(localStorage,key,{value,enumerable:true,configurable:true});},removeItem:key=>{store.delete(key);delete localStorage[key];}};
Object.defineProperty(navigator,'locks',{value:{request:async(name,operation)=>operation({name})},configurable:true});
test('catálogo migra uma vez, preserva exclusões e só instala novos IDs explicitamente',async()=>{
  await initializeCatalogInstallations(['dnd2024','fate']);assert.deepEqual(catalogInstallationIds(),['dnd2024','fate']);
  await transact([catalogInstallationsChange([])]);
  await initializeCatalogInstallations(['dnd2024','fate','novo']);assert.deepEqual(catalogInstallationIds(),[]);
  localStorage.setItem(CATALOG_KEY,'{ broken');assert.throws(catalogInstallationIds,/inválida/);await flushLibraryWrites();assert.equal(readRaw(CATALOG_KEY),'{ broken');
});
test('backup aceita seleção vazia e IDs futuros, recusa nulo, duplicidade e IDs inválidos',()=>{
  const data={schemaVersion:1,kind:'rpg-library-backup',systems:[],characters:[],preferences:{zero:0,empty:'',flag:false,nullable:null}};
  assert.deepEqual(validateLibraryBackup(data),[]);
  for(const ids of [[],['novo-sistema'],['id.com espaço e acento']])assert.deepEqual(validateLibraryBackup({...data,catalogSystems:ids}),[]);
  for(const ids of [null,['a','a'],[' '],{},[false]])assert.ok(validateLibraryBackup({...data,catalogSystems:ids}).some(issue=>issue.path==='backup.catalogSystems'));
  assert.equal(validCatalogIds([]),true);
  const reserved=minimalPackage('reserved');
  assert.ok(validateLibraryBackup({...data,systems:[reserved]},{builtinIds:['reserved']}).length);
  assert.deepEqual(validateLibraryBackup({...data,systems:[reserved],catalogSystems:['reserved']},{builtinIds:['reserved']}),[]);
});
test('versão futura continua protegida de sobrescrita e só permite exclusão explicitamente confirmada',async()=>{
  const key='ficha-rpg:v2:characters:future-delete',raw='{"schemaVersion":99,"meta":{"system":"dnd2024"}}';localStorage.setItem(key,raw);
  readJson(key,null,()=>false);await flushLibraryWrites();
  await assert.rejects(transact([[key,null]]),/não suportada/);
  await assert.rejects(withLibraryWrite(()=>transactWithinWrite([[key,'{}']],{confirmedDeletionKeys:[key]})),/não suportada/);
  assert.equal(readRaw(key),raw);
  await withLibraryWrite(()=>transactWithinWrite([[key,null]],{confirmedDeletionKeys:[key]}));assert.equal(readRaw(key),null);
});
