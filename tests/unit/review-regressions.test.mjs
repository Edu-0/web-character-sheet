import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDocument} from '../../js/validation/documents.js';
import {validateSystemPackage,validateCharacterForPackage} from '../../js/validation/schemas.js';
import {validateRollOptions} from '../../js/validation/entry-rolls.js';
import {checkSources,prepareCheck} from '../../js/engine/checks.js';
import {activateEffect} from '../../js/engine/effects.js';
import {COMPONENT_CONTRACTS} from '../../js/validation/contracts.js';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const generic=()=>read('data/examples/generic-entry-rolls.package.json');
const buttons=()=>read('data/examples/check-buttons.package.json');
const swade=()=>({schemaVersion:2,kind:'rpg-system-package',system:read('data/systems/swade.system.json'),layouts:[read('data/systems/swade.layout.json')]});
const errors=issues=>issues.filter(issue=>issue.severity!=='warning');

test('R1: normalização só alcança contratos conhecidos, em pacote/personagem/backup',()=>{
  const pkg=generic(),opaque={test:{zero:0},rollOptions:{attack:false,upcast:'texto próprio'}};
  pkg.system.entryRolls.skillCheck.extensions=structuredClone(opaque);
  pkg.system.characterTemplate.extensions=structuredClone(opaque);
  pkg.system.characterTemplate.unrelated=[{rollOptions:{attack:false,upcast:'opaco'}}];
  const config=pkg.system.entryRolls.skillCheck;config.test=config.check;delete config.check;
  const component=pkg.layouts[0].tabs.flatMap(t=>t.sections).flatMap(s=>s.containers).flatMap(c=>c.components).find(c=>c.entryAction==='roll');
  component.rollConfigFrom=component.rollPreset;delete component.rollPreset;
  pkg.system.characterTemplate.techniques[0].rollOptions={attack:false,attackModifier:'0',upcast:'',extensions:opaque};
  const before=structuredClone(pkg),result=prepareDocument(pkg,{kind:'package',normalize:true});
  assert.equal(result.status,'needsMigration',JSON.stringify(result.diagnostics));assert.deepEqual(pkg,before);
  assert.deepEqual(result.document.system.entryRolls.skillCheck.extensions,opaque);
  assert.deepEqual(result.document.system.characterTemplate.extensions,opaque);
  assert.deepEqual(result.document.system.characterTemplate.unrelated,before.system.characterTemplate.unrelated);
  assert.deepEqual(result.document.system.characterTemplate.techniques[0].rollOptions,{checkEnabled:false,modifier:'0',increment:'',extensions:opaque});
  assert.equal(prepareDocument(result.document,{kind:'package',normalize:true}).status,'ready');
  const character={...structuredClone(before.system.characterTemplate),meta:{id:'c',system:pkg.system.id}};
  assert.deepEqual(prepareDocument(character,{kind:'character',normalize:true}).document,character);
  assert.equal(prepareDocument(character,{kind:'character',pkg:result.document,normalize:true}).status,'needsMigration');
  const backup={schemaVersion:1,kind:'rpg-library-backup',systems:[before],characters:[character],preferences:{},extensions:opaque};
  const restored=prepareDocument(backup,{kind:'backup',normalize:true});
  assert.equal(restored.status,'needsMigration',JSON.stringify(restored.diagnostics));
  assert.deepEqual(restored.document.extensions,opaque);assert.deepEqual(restored.document.characters[0].extensions,opaque);
  assert.equal(restored.document.characters[0].techniques[0].rollOptions.checkEnabled,false);
});

test('R3: todos os aliases conflitantes são recusados, com e sem migração',()=>{
  const pkg=generic();
  for(const options of [{attack:false,checkEnabled:true},{attack:false,testEnabled:true},{attackModifier:'1',modifier:'0'},{upcast:'1d6',increment:'1d4'},{testExpression:'1d6',checkExpression:'1d4'}]) {
    const issues=[];validateRollOptions(options,'options',issues);assert.ok(issues.length);
    const character=structuredClone(pkg.system.characterTemplate);character.techniques[0].rollOptions=options;
    for(const normalize of [false,true]) assert.equal(prepareDocument(character,{kind:'character',pkg,allowMissingId:true,normalize}).status,'invalid');
  }
});

test('R4: ID numérico e índice legado têm seletores distintos e rolam sua própria fonte',()=>{
  const pkg=buttons(),character=structuredClone(pkg.system.characterTemplate);
  character.meta.id='test';character.skills=[{name:'Legado',rating:1},{id:'0',name:'Explícito',rating:5}];
  assert.deepEqual(errors(validateCharacterForPackage(character,pkg)),[]);
  const sources=checkSources(pkg.system.checks.action,character,pkg.system).filter(source=>source.sourceId==='skill');
  assert.equal(new Set(sources.map(source=>source.id)).size,2);
  for(const [index,source] of sources.entries()) {
    const prepared=prepareCheck({config:pkg.system.checks.action,character,system:pkg.system,checkId:'action',sourceId:source.id});
    assert.equal(prepared.snapshot.options.value,[1,5][index]);
    assert.equal(prepared.execute(()=>2).total,[1,5][index]);
  }
  character.skills.reverse();
  assert.equal(checkSources(pkg.system.checks.action,character,pkg.system).find(source=>source.id===sources[1].id).value,5);
});

test('R5: duração histórica é preservada; só a instância ativa exige revisão disponível',()=>{
  const pkg=swade(),character=structuredClone(pkg.system.characterTemplate);character.meta.id='test';
  activateEffect(character,pkg.system,'joker','one');const old=structuredClone(character.activeEffects[0]);
  pkg.system.effectDefinitions[0].revision=2;pkg.system.effectDefinitions[0].duration={type:'manual'};
  for(const status of ['inactive','expired']) {
    character.activeEffects[0].status=status;
    const issues=validateCharacterForPackage(character,pkg);
    assert.deepEqual(errors(issues),[]);assert.ok(issues.some(issue=>issue.severity==='warning'));
    assert.deepEqual(character.activeEffects[0],{...old,status});
  }
  character.activeEffects[0].status='active';assert.ok(errors(validateCharacterForPackage(character,pkg)).length);
  character.activeEffects[0].status='expired';character.activeEffects[0].duration.event='timer';
  assert.ok(errors(validateCharacterForPackage(character,pkg)).length);
  character.activeEffects[0].duration=old.duration;character.activeEffects[0].definitionRevision=2;
  assert.ok(errors(validateCharacterForPackage(character,pkg)).some(issue=>issue.path.endsWith('.duration')));
});

test('R6: template valida definições, revisão, duplicidade e grupo como um personagem',()=>{
  for(const mutate of [
    (p,c)=>c.activeEffects[0].definitionId='missing',
    (p,c)=>c.activeEffects[0].definitionRevision=99,
    (p,c)=>c.activeEffects.push({...c.activeEffects[0],id:'two'}),
    (p,c)=>{p.system.effectDefinitions[0].group='exclusive';p.system.effectDefinitions.push({...structuredClone(p.system.effectDefinitions[0]),id:'other'});c.activeEffects.push({...c.activeEffects[0],id:'two',definitionId:'other'});}
  ]) {
    const pkg=swade(),character=pkg.system.characterTemplate;activateEffect(character,pkg.system,'joker','one');
    assert.deepEqual(errors(validateSystemPackage(pkg)),[]);mutate(pkg,character);
    const result=prepareDocument(pkg,{kind:'package'});assert.equal(result.status,'invalid');
    assert.ok(result.diagnostics.some(issue=>issue.pointer.startsWith('/system/characterTemplate/activeEffects/')));
  }
  const pkg=swade();activateEffect(pkg.system.characterTemplate,pkg.system,'joker','old');
  pkg.system.characterTemplate.activeEffects[0].status='expired';pkg.system.effectDefinitions[0].revision=2;pkg.system.effectDefinitions[0].duration={type:'manual'};
  assert.deepEqual(errors(validateSystemPackage(pkg)),[]);
});

test('R7: default documentado de pointBudget é aceito; configurações inválidas continuam recusadas',()=>{
  const pkg=buttons(),component={type:'pointBudget',label:'Pontos'};
  pkg.layouts[0].tabs[0].sections[0].containers[0].components.push(component);
  const defaultPath=COMPONENT_CONTRACTS.pointBudget.properties.configFrom.default;
  assert.equal(defaultPath,'pointBudget');pkg.system[defaultPath]={sources:[]};
  assert.deepEqual(errors(validateSystemPackage(pkg)),[]);
  component.configFrom='pointBudget';assert.deepEqual(errors(validateSystemPackage(pkg)),[]);
  for(const value of ['',null,'missing']) {component.configFrom=value;assert.ok(errors(validateSystemPackage(pkg)).length);}
  delete component.configFrom;delete pkg.system.pointBudget;assert.ok(errors(validateSystemPackage(pkg)).length);
});
