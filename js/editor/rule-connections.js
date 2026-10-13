// Derived connections; every edit is a plan for the existing canonical commands.
import {dataDefinitions} from '../engine/data-definitions.js';
import {knownReferences} from './references.js';
import {dataIndex,displayData} from './data-index.js';
import {compileActionFlow} from '../engine/action-plan.js';
import {ruleNode} from './typed-data-commands.js';
import {setValueCommands,pointerPath} from './form-commands.js';
import {valueAt} from './form-structure.js';
import {applyOperations} from './operations.js';
import {prepareDocument} from '../validation/documents.js';
import {pointerFor} from './source-map.js';
import {structuralNodes} from './form-structure.js';
import {cachedProjection} from './projection-cache.js';
import {EVENT_INPUT_PORTS} from '../engine/event-inputs.js';

const identityRoles={dataId:'data',fieldId:'field',ruleId:'rule',catalogId:'catalog',actionId:'action',optionId:'option',definitionId:'effect',dataParameter:'parameter',check:'check',sourceId:'checkSource',rollPreset:'entryRoll',rollConfigFrom:'entryRoll',formula:'formula',inputId:'input',localId:'local',creationDataId:'data',evolutionDataId:'data',maxDataId:'data',fromFieldId:'field',toFieldId:'field',costFieldId:'field'};
const roots=['rules','dataDefinitions','catalogs','componentDefinitions','sheetActions','effectDefinitions','ruleTriggers','progressionChoices'];
export function ruleSources(pkg){
 return cachedProjection(pkg,'connectionSources',()=>buildRuleSources(pkg));
}
function buildRuleSources(pkg){
 const rows=[],seen=new Set(),add=(kind,value,label,extra={})=>{const key=kind+':'+(extra.actionId?extra.actionId+':':extra.definitionId?extra.definitionId+':':extra.enumDataId?extra.enumDataId+':':'')+value;if(seen.has(key))return;seen.add(key);rows.push({key,kind,value,label,...extra});};
 for(const row of dataDefinitions(pkg.system)){const label=row.ancestors.map(parent=>parent.label).concat(row.definition.label).join(' › ');add(row.ancestors.length?'field':'data',row.definition.id,label,{type:row.definition.type,definition:row.definition});if(row.ancestors.length)add('data',row.definition.id,label,{type:row.definition.type,definition:row.definition});if(row.definition.type==='enum')for(const option of row.definition.options||[])add('enumOption',option.id,label+' › '+option.label,{enumDataId:row.definition.id});}
 for(const catalog of pkg.system.catalogs||[]){add('catalog',catalog.id,catalog.label);const walk=fields=>{for(const field of fields){add('field',field.id,catalog.label+' › '+field.label,{type:field.type,definition:field});if(field.fields)walk(field.fields);}};walk(catalog.fields);}
 for(const rule of pkg.system.rules||[])add('rule',rule.id,rule.label,{type:rule.resultType,context:rule.context,purpose:rule.kind});
 for(const [name]of Object.entries(pkg.system.formulas||{}))add('formula',name,name);
 for(const [name,config]of Object.entries(pkg.system.checks||{})){add('check',name,config.label||name);for(const source of config.sources||[])add('checkSource',source.id,(config.label||name)+' › '+source.label,{checkId:name});}
 for(const [name,config]of Object.entries(pkg.system.entryRolls||{}))add('entryRoll',name,config.label||name);
 for(const [port,label]of Object.entries(EVENT_INPUT_PORTS))add('eventPort',port,label);
 for(const action of pkg.system.sheetActions||[]){add('action',action.id,action.label);const inputFields=(fields,prefix)=>{for(const field of fields||[]){add('field',field.id,prefix+' › '+field.label,{actionId:action.id,type:field.type,definition:field});inputFields(field.fields,prefix+' › '+field.label);}};for(const input of action.flow?.inputs||[]){add('input',input.id,action.label+' › '+input.label,{actionId:action.id,type:input.type});inputFields(input.fields,action.label+' › '+input.label);}try{for(const local of compileActionFlow(pkg.system,action).locals){add('local',local.id,action.label+' › '+local.label,{actionId:action.id,type:local.valueType.type});inputFields(local.valueType.definition?.fields,action.label+' › '+local.label);}}catch{/* Invalid drafts still keep their visible source declarations. */}}
 for(const definition of pkg.system.effectDefinitions||[])add('effect',definition.id,definition.label);
 for(const option of pkg.system.progressionChoices?.options||[])add('option',option.id,option.label);
 for(const definition of pkg.system.componentDefinitions||[]){add('composition',definition.id,definition.label);for(const parameter of definition.parameters||[])add('parameter',parameter.id,definition.label+' › '+parameter.label,{definitionId:definition.id,type:parameter.type});}
 for(const key of ['progressionChoices','ruleTriggers'])if(pkg.system[key])add('configuration',key,key==='progressionChoices'?'Criação e evolução':'Eventos e gatilhos');
 for(const component of structuralNodes(pkg).filter(node=>node.kind==='component'))add('component',component.pointer,component.value.label||component.value.type,{path:component.path});
 for(const row of dataIndex(pkg).filter(row=>!row.typed))add(row.scope==='character'?'fieldPath':'systemPath',row.field,displayData(row),{type:row.type});
 return rows;
}

function actionOwner(pkg,path){return path[0]==='system'&&path[1]==='sheetActions'?pkg.system.sheetActions[path[2]]?.id:path[0]==='system'&&path[1]==='ruleTriggers'?pkg.system.ruleTriggers[path[2]]?.actionId:undefined;}
export function ruleConnections(pkg){
 return cachedProjection(pkg,'connections',()=>buildRuleConnections(pkg));
}
function buildRuleConnections(pkg){
 const slots=new Map();
 for(const reference of knownReferences(pkg)){const kind=identityRoles[reference.kind]||(['field','historyField','binding','source'].includes(reference.kind)||reference.kind.endsWith('Field')?'fieldPath':['configFrom','actionsFrom','optionsFrom','presetsFrom','traitsFrom','costsFrom','labelsFrom','catalogFrom','progressionFrom','formulaFrom','attributesFrom','categoriesFrom','baseDieFrom','sidesFrom'].includes(reference.kind)||reference.kind==='system'&&reference.pointer.includes('/variables/')?'systemPath':null);if(kind)slots.set(reference.pointer,{...reference,role:kind});}
 const walk=(value,path)=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(['extensions','metadata','extra','extras'].includes(key))continue;const next=[...path,Array.isArray(value)?Number(key):key],pointer=pointerFor(next);
  if(typeof child==='string'&&identityRoles[key])slots.set(pointer,{pointer,value:child,role:identityRoles[key],actionId:actionOwner(pkg,path)});
  if(typeof child==='string'&&key==='port'&&path.includes('inputBindings')&&path[1]==='ruleTriggers')slots.set(pointer,{pointer,value:child,role:'eventPort'});
  if(typeof child==='string'&&path.at(-1)==='requires'&&path.includes('progressionChoices'))slots.set(pointer,{pointer,value:child,role:'option'});
  if(key==='values'&&child&&typeof child==='object'&&typeof value.dataId==='string')for(const fieldId of Object.keys(child)){const target=[...next,fieldId];slots.set(pointerFor(target),{pointer:pointerFor(target),value:fieldId,role:'field',fieldKey:true,targetDataId:value.dataId,actionId:actionOwner(pkg,path)});}
  walk(child,next);
 }};for(const root of roots)walk(pkg.system[root],['system',root]);
 return [...slots.values()].map(slot=>{const path=pointerPath(pkg,slot.pointer),owner=valueAt(pkg,path.slice(0,-1));return {...slot,path,label:slot.pointer,role:slot.role==='effect'&&owner?.type==='componentInstance'?'composition':slot.role==='option'&&owner?.op==='option'?'enumOption':slot.role,enumDataId:owner?.op==='option'?owner.dataId:undefined,expectedDataType:slot.role==='data'&&path.at(-1)==='dataId'?{option:'enum',trait:'trait',empty:'collection',entryReference:'reference'}[owner?.op]:undefined,definitionId:path[0]==='system'&&path[1]==='componentDefinitions'?pkg.system.componentDefinitions[path[2]]?.id:undefined,actionId:slot.actionId||actionOwner(pkg,path),checkId:owner?.check,expressionSource:!slot.fieldKey&&['read','rule'].includes(owner?.op)&&['dataId','ruleId'].includes(path.at(-1))};});
}

export function connectionOwner(pkg,slot){
 const path=slot.path;if(path[0]==='system'){
  const root=path[1],value=pkg.system[root];if(root==='formulas')return 'formula:'+path[2];if(root==='checks')return 'check:'+path[2];if(root==='entryRolls')return 'entryRoll:'+path[2];if(root==='rules')return 'rule:'+value[path[2]]?.id;if(root==='sheetActions')return 'action:'+value[path[2]]?.id;if(root==='effectDefinitions')return 'effect:'+value[path[2]]?.id;if(root==='componentDefinitions')return 'composition:'+value[path[2]]?.id;
  if(root==='dataDefinitions')return 'data:'+value[path[2]]?.id;if(root==='catalogs')return 'catalog:'+value[path[2]]?.id;if(root==='progressionChoices'&&path[2]==='options')return 'option:'+value.options[path[3]]?.id;if(['progressionChoices','ruleTriggers'].includes(root))return 'configuration:'+root;
 }
 const component=structuralNodes(pkg).find(node=>node.kind==='component'&&slot.pointer.startsWith(node.pointer+'/'));return component?'component:'+component.pointer:null;
}

export function connectionSources(pkg,slot){
 return cachedProjection(pkg,'connectionCandidates:'+JSON.stringify([slot.pointer,slot.role,slot.actionId,slot.definitionId,slot.targetDataId,slot.expressionSource,slot.fieldKey,slot.enumDataId,slot.expectedDataType]),()=>buildConnectionSources(pkg,slot));
}
function buildConnectionSources(pkg,slot){
 const sources=ruleSources(pkg),allowed=slot.expressionSource?new Set(['data','rule']):new Set([slot.role]);
 let fields;if(slot.fieldKey)fields=dataDefinitions(pkg.system).find(row=>row.definition.id===slot.targetDataId)?.definition.fields?.map(field=>field.id);
 return sources.filter(source=>allowed.has(source.kind)&&(!slot.expectedDataType||source.type===slot.expectedDataType)&&(source.kind!=='enumOption'||source.enumDataId===slot.enumDataId)&&(!['input','local'].includes(source.kind)||source.actionId===slot.actionId)&&(source.kind!=='parameter'||source.definitionId===slot.definitionId)&&(!source.actionId||source.actionId===slot.actionId)&&(source.kind!=='checkSource'||source.checkId===slot.checkId)&&(!slot.fieldKey||fields?.includes(source.value)));
}

export function connectRuleSource(pkg,pointer,sourceKey,{mode}={}){
 const slot=ruleConnections(pkg).find(slot=>slot.pointer===pointer);if(!slot)throw Error('Vínculo executável não encontrado.');const source=connectionSources(pkg,slot).find(source=>source.key===sourceKey);if(!source)throw Error('Fonte incompatível com este vínculo.');let commands;
 if(slot.expressionSource){const path=slot.path.slice(0,-1),before=valueAt(pkg,path),op=source.kind==='data'?'read':'rule',node=ruleNode(op,before);node[source.kind==='data'?'dataId':'ruleId']=source.value;node.mode=mode||(before.op===op?before.mode:undefined)||(op==='read'?'base':'automatic');commands=setValueCommands(pkg,path,node);}
 else if(slot.fieldKey){const path=slot.path.slice(0,-1);if(source.value!==slot.value&&Object.hasOwn(valueAt(pkg,path),source.value))throw Error('Este campo já recebe um valor.');commands=source.value===slot.value?[]:[{type:'removeProperty',path:slot.path},{type:'setProperty',path:[...path,source.value],value:structuredClone(valueAt(pkg,slot.path))}];}
 else commands=setValueCommands(pkg,slot.path,source.value);
 let candidate=JSON.parse(applyOperations(JSON.stringify(pkg),commands));if(JSON.stringify(candidate)===JSON.stringify(pkg))commands=[];
 if(commands.length&&slot.path[0]==='system'){
  const root=slot.path[1],index=slot.path[2],before=root==='progressionChoices'?pkg.system.progressionChoices:['rules','effectDefinitions'].includes(root)?pkg.system[root]?.[index]:root==='sheetActions'?pkg.system.sheetActions?.[index]?.flow:null;
  if(before&&Number.isSafeInteger(before.revision)){const path=root==='progressionChoices'?['system',root,'revision']:root==='sheetActions'?['system',root,index,'flow','revision']:['system',root,index,'revision'];commands.push({type:'setProperty',path,value:before.revision+1});candidate=JSON.parse(applyOperations(JSON.stringify(pkg),commands));}
 }
 const prepared=prepareDocument(candidate,{kind:'package'});if(prepared.status!=='ready')throw Error(prepared.diagnostics.slice(0,3).map(diagnostic=>diagnostic.message).join('; '));return {commands,pointer:slot.pointer,sourceKey:source.key};
}

export function graphPosition(ui,key,index=0){
 const saved=ui.ruleGraph?.positions?.[key];if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))return {x:Math.min(8000,Math.max(24,saved.x)),y:Math.min(8000,Math.max(24,saved.y))};return {x:24+(index%3)*280,y:24+Math.floor(index/3)*88};
}
export function moveGraphNode(ui,key,position){ui.ruleGraph??={};ui.ruleGraph.positions??={};ui.ruleGraph.positions[key]={x:Math.min(8000,Math.max(24,Number(position.x)||0)),y:Math.min(8000,Math.max(24,Number(position.y)||0))};}
