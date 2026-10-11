import {pathKeys} from '../engine/paths.js';
import {DATA_TYPES, BOUND_COMPONENT_TYPES, readData, valueIssue, dataDefinitions,initializeData} from '../engine/data-definitions.js';
import {DATA_LIMITS,typedValueIssue,recordValue} from '../engine/data-types.js';
import {referenceValueIssue} from '../engine/data-references.js';
import {compileRules} from '../engine/rule-registry.js';
const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const id=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v) && !['constructor','prototype','__proto__'].includes(v);
export function validateDataDefinitions(system, character=system.characterTemplate, root='system.characterTemplate',{definitionsOnly=false}={}) {
  const issues=[], add=(path,message)=>issues.push({path,message,code:'data.invalid'}), definitions=system.dataDefinitions===undefined?[]:system.dataDefinitions;
  if(system.schemaVersion!==3)return issues; // Legacy unknown roots keep their previous meaning.
  if(!Array.isArray(definitions) || definitions.length>500) {add('system.dataDefinitions','lista de até 500 dados exigida');return issues;}
  const ids=new Set(), bindings=[];let count=0;
  const validateDefinition=(d,at,depth=0,nested=false,catalogField=false)=>{
    if(++count>DATA_LIMITS.definitions || depth>DATA_LIMITS.depth){add(at,'limite de definições excedido');return;}
    if(!object(d)) {add(at,'definição deve ser objeto');return;}
    if(!id(d.id) || ids.has(d.id)) add(at+'.id','identidade inválida ou duplicada');ids.add(d.id);
    if(typeof d.label!=='string' || !d.label.trim()) add(at+'.label','informe o nome');
    if(!DATA_TYPES.includes(d.type)) add(at+'.type','tipo indisponível neste recorte');
    for(const key of ['required','nullable']) if(typeof d[key]!=='boolean') add(at+'.'+key,'booleano explícito exigido');
    if(d.description!==undefined && typeof d.description!=='string') add(at+'.description','deve ser texto');
    // Unsupported executable/restriction options must not look functional.
    const parameters={number:['minimum','maximum'],integer:['minimum','maximum'],string:['maxLength'],enum:['options'],trait:['scale','composite'],record:['fields'],collection:['fields','minItems','maxItems','unique'],reference:['target','multiple']}[d.type]||[];
    for(const key of Object.keys(d)) if(!['id','label','description','type','binding','required','nullable','initial','extensions',...parameters].includes(key)) add(at+'.'+key,'opção de dado indisponível; metadados seguros pertencem a extensions');
    for(const key of ['minimum','maximum'])if(d[key]!==undefined && !Number.isFinite(d[key]))add(at+'.'+key,'limite finito exigido');
    if(d.minimum!==undefined && d.maximum!==undefined && d.minimum>d.maximum)add(at,'mínimo maior que máximo');
    for(const key of ['maxLength','minItems','maxItems'])if(d[key]!==undefined && (!Number.isSafeInteger(d[key])||d[key]<0||d[key]>10000))add(at+'.'+key,'limite inteiro de0 a10000 exigido');
    if(d.minItems!==undefined && d.maxItems!==undefined && d.minItems>d.maxItems)add(at,'cardinalidade mínima maior que máxima');
    if(d.type==='enum'){
      if(!Array.isArray(d.options)||!d.options.length||d.options.length>500||d.options.some(o=>!object(o)||!id(o.id)||typeof o.label!=='string'||!o.label.trim())||new Set(d.options.map(o=>o?.id)).size!==d.options.length)add(at+'.options','opções nomeadas com identidades únicas exigidas');
    }
    if(d.type==='trait'){
      if(!Array.isArray(d.scale)||!d.scale.length||d.scale.length>32||d.scale.some((v,i)=>!Number.isSafeInteger(v)||v<2||v>1000||i>0&&v<=d.scale[i-1]))add(at+'.scale','escala crescente de dados exigida');
      if(typeof d.composite!=='boolean')add(at+'.composite','composição explícita exigida');
    }
    if(['record','collection'].includes(d.type)) {
      if(!Array.isArray(d.fields)||d.fields.length>DATA_LIMITS.fields)add(at+'.fields','campos limitados exigidos');
      else {const keys=new Set();d.fields.forEach((f,i)=>{validateDefinition(f,at+'.fields['+i+']',depth+1,true,catalogField);if(keys.has(f?.binding))add(at+'.fields['+i+'].binding','campo duplicado');keys.add(f?.binding);});}
      if(d.unique!==undefined && (!Array.isArray(d.unique)||d.unique.some(k=>!d.fields?.some?.(f=>f.id===k))||new Set(d.unique).size!==d.unique.length))add(at+'.unique','selecione campos existentes e distintos');
    }
    if(d.type==='reference') {
      if(catalogField&&d.target?.scope==='character')add(at+'.target','Referência de catálogo deve apontar para catálogo do sistema');
      if(typeof d.multiple!=='boolean')add(at+'.multiple','cardinalidade explícita exigida');
      if(!object(d.target)||!['character','system'].includes(d.target.scope))add(at+'.target','destino tipado exigido');
      else if(d.target.scope==='character') {let target;try{target=dataDefinitions(system).find(r=>r.definition.id===d.target.dataId)?.definition;}catch{}if(target?.type!=='collection')add(at+'.target','coleção destino inexistente');}
      else if(!system.catalogs?.some?.(c=>c?.id===d.target.catalogId))add(at+'.target','catálogo destino inexistente');
      if(object(d.target)&&Object.keys(d.target).some(k=>!['scope',d.target.scope==='system'?'catalogId':'dataId'].includes(k)))add(at+'.target','parâmetro de destino indisponível');
    }
    try {
      const keys=pathKeys(d.binding);
      if(nested){if(keys.length!==1||keys[0]==='id')throw new Error('Campo aninhado exige chave única não reservada à identidade');}
      if(!nested&&['schemaVersion','meta','activeEffects','calculationOverrides','actionRecords'].includes(keys[0])) throw new Error('Binding reservado ao documento');
      if(!nested && bindings.some(b=>b===d.binding || b.startsWith(d.binding+'.') || d.binding.startsWith(b+'.'))) throw new Error('Binding sobreposto a outra identidade');
      if(!nested)bindings.push(d.binding);
      if(Object.hasOwn(d,'initial')) {const problem=typedValueIssue(d,d.initial,{allowInitial:true});if(problem)add(at+'.initial',problem);}
      if(nested||definitionsOnly)return;
      const cell=readData(system,character,d.id);
      if(d.required && !cell.present && !(character===system.characterTemplate && Object.hasOwn(d,'initial'))) add(root+'.'+d.binding,'dado obrigatório ausente');
      // An existing scalar parent cannot be replaced during an interaction.
      let owner=character;for(const key of keys.slice(0,-1)){if(owner==null)break;if(typeof owner!=='object' || Array.isArray(owner))throw new Error('Binding atravessa valor não estruturado');owner=Object.hasOwn(owner,key)?owner[key]:undefined;}
      if(owner!==undefined && (owner===null || typeof owner!=='object' || Array.isArray(owner))) throw new Error('Binding atravessa valor não estruturado');
    } catch(error) {add(at+'.binding',error.message);}
  };
  definitions.forEach((d,i)=>validateDefinition(d,`system.dataDefinitions[${i}]`));
  if(system.catalogs!==undefined){
    if(!Array.isArray(system.catalogs)||system.catalogs.length>100)add('system.catalogs','lista de até100 catálogos exigida');
    else {const catalogIds=new Set();system.catalogs.forEach((catalog,i)=>{
      const at=`system.catalogs[${i}]`;
      if(!object(catalog)||!id(catalog.id)||catalogIds.has(catalog.id)||typeof catalog.label!=='string'||!catalog.label.trim()){add(at,'catálogo nomeado com ID único exigido');return;}catalogIds.add(catalog.id);
      if(!Array.isArray(catalog.fields)||catalog.fields.length>DATA_LIMITS.fields)add(at+'.fields','campos limitados exigidos');
      else {const bindings=new Set();catalog.fields.forEach((f,j)=>{validateDefinition(f,at+'.fields['+j+']',0,true,true);if(bindings.has(f?.binding))add(at+'.fields['+j+'].binding','campo duplicado');bindings.add(f?.binding);});}
      const issue=typedValueIssue({type:'collection',fields:catalog.fields||[],nullable:false},catalog.entries);if(issue)add(at+'.entries',issue);
      if(Object.keys(catalog).some(k=>!['id','label','fields','entries','extensions'].includes(k)))add(at,'parâmetro de catálogo indisponível');
    });}
  }
  if(definitionsOnly)return issues;
  let referenceCharacter=character;
  if(!issues.length&&character===system.characterTemplate)try{referenceCharacter=initializeData(system,structuredClone(character));}catch(error){add(root,error.message);}
  const references=(definition,value,context={})=>{
    if(value===null || value===undefined)return;
    if(definition.type==='reference'){const issue=referenceValueIssue(system,referenceCharacter,definition,value,context);if(issue)add(root+'.'+definition.binding,issue);}
    if(definition.type==='record'&&recordValue(value))for(const field of definition.fields||[])if(Object.hasOwn(value,field.binding))references(field,value[field.binding],context);
    if(definition.type==='collection'&&Array.isArray(value))for(const entry of value)for(const field of definition.fields||[])if(entry&&Object.hasOwn(entry,field.binding))references(field,entry[field.binding],{entries:[...(context.entries||[]),{dataId:definition.id,entryId:entry.id}]});
  };
  if(!issues.length)for(const d of definitions){const cell=readData(system,referenceCharacter,d.id);if(cell.present)references(d,cell.value);}
  if(!issues.length)for(const catalog of system.catalogs||[])for(const entry of catalog.entries)for(const field of catalog.fields)if(Object.hasOwn(entry,field.binding))references(field,entry[field.binding]);
  return issues;
}
export function validateRules(system) {
  if(system.rules===undefined||system.schemaVersion!==3)return [];
  try{compileRules(system);return [];}catch(error){return [{path:error.path||'system.rules',message:error.message,code:'rule.invalid',...(error.nodeId?{nodeId:error.nodeId}:{})}];}
}
export function validateBinding(component, system, path, layoutVersion) {
  const issues=[],add=(key,message)=>issues.push({path:path+'.'+key,message,code:'binding.invalid'});
  if(component.dataId!==undefined){
    if(!Object.hasOwn(BOUND_COMPONENT_TYPES,component.type))add('dataId','consumidor não admite vínculo tipado');
    if(layoutVersion!==3 || system && system.schemaVersion!==3)add('dataId','vínculo exige layout e sistema v3');
    let d;try{d=dataDefinitions(system).find(row=>row.definition.id===component.dataId)?.definition;}catch{}
    if(!id(component.dataId) || system && (!d || !BOUND_COMPONENT_TYPES[component.type]?.includes(d.type)))add('dataId','dado inexistente ou incompatível');
    if(component.field!==undefined || component.default!==undefined || component.ruleId!==undefined)add('dataId','use somente dataId; binding e inicial pertencem ao dado');
  }
  if(component.ruleId!==undefined){
    if(layoutVersion!==3 || system && system.schemaVersion!==3)add('ruleId','regra exige layout e sistema v3');
    if(component.type!=='computed' || !id(component.ruleId) || system && !(Array.isArray(system.rules)?system.rules:[]).some(r=>r?.id===component.ruleId))add('ruleId','cálculo inexistente ou consumidor incompatível');
    if(component.formula!==undefined || component.variables!==undefined || component.mode!==undefined)add('ruleId','não combinar com fórmula/variáveis/modo legado');
  }
  return issues;
}
