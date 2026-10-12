import {RULE_OPERATIONS,RULE_LIMITS} from './rule-operations.js';
import {compileRules,QUERY_PORTS} from './rule-analysis.js';
import {readData} from './data-definitions.js';
import {referenceValueIssue} from './data-references.js';
import {dataDefinitions} from './data-definitions.js';
import {typedValueIssue} from './data-types.js';
import {calculationValue,getCalculationOverride} from './calculation-overrides.js';
import {inspectJson} from '../validation/limits.js';
import {projectTypedTarget} from './typed-effect-runtime.js';
export {RULE_OPERATIONS,RULE_LIMITS,compileRules};
const summary=cell=>!cell.present?'Ausente':cell.value===null?'null explícito':Array.isArray(cell.value)?cell.value.length+' entrada(s)':typeof cell.value==='object'?'Registro':cell.value===true?'Sim':cell.value===false?'Não':String(cell.value).slice(0,160);
export function ruleCalculationKey(system,id,context={}){
 const rule=system.rules?.find(r=>r.id===id),row=rule?.context?dataDefinitions(system).find(r=>r.definition.id===rule.context.dataId):null;
 const scopes=row?[...row.ancestors.filter(d=>d.type==='collection').map(d=>d.id),row.definition.id]:[];
 const entries=scopes.map(dataId=>context.entries?.findLast(e=>e.dataId===dataId));if(entries.some(e=>!e))throw Error('Contexto de entrada ausente para o cálculo');
 return 'computed.'+id+(entries.length?'.entries.'+entries.flatMap(e=>[e.dataId,e.entryId]).join('.'):'');
}
// One disposable context for a validated package/character revision. Mutable
// callers use evaluateRule without a context and never receive stale caches.
export function createRuleContext(system,character,{dataContext={},trace=false,budget,actionScope,actionInputs={},actionLocals={},projectionSystem=system,projectionStack=new Set(),onEffectUse=()=>{}}={}){
 const safety=inspectJson(system,'system');if(safety.length)throw Error(safety[0].message);
 const compiled=compileRules(system,{actionScope}),memo=new Map(),readings=new Map(),traceRows=[];let indices=new WeakMap();
 let steps=0,visits=0;const shared=budget??{remaining:100000};
 const charge=(entries=0)=>{steps++;visits+=entries;shared.remaining-=1+entries;if(steps>RULE_LIMITS.steps||visits>RULE_LIMITS.visits||shared.remaining<0)throw Error('Orçamento de avaliação/consulta excedido');};
 const checkCharacter=()=>{const safety=inspectJson(character,'character');if(safety.length)throw Error(safety[0].message);};checkCharacter();
 const contextFor=(record,info,frame)=>{
  const source=info.scopes.length?frame.items.get(info.scopes.at(-1))?.cell.dataContext:frame.dataContext;
  const ids=info.scopes.length?[...new Set((source?.entries||[]).map(e=>e.dataId))]:record.contextCollections;
  return {entries:ids.map(dataId=>source?.entries?.findLast(e=>e.dataId===dataId)).filter(Boolean)};
 };
 const keyFor=(record,info,frame)=>JSON.stringify([record.rule.id,info.node.id,contextFor(record,info,frame),info.scopes.map(id=>frame.items.get(id)?.token)]);
 const error=(info,message)=>{const e=Error(info.rule.label+' › '+(RULE_OPERATIONS[info.node.op]?.label||info.node.op)+': '+message);e.nodeId=info.node.id;e.path=info.path;return e;};
 const present=(cell,info,allowNull=false)=>{if(!cell.present)throw error(info,'Fonte ausente'+(cell.definition?.label?' ('+cell.definition.label+')':''));if(cell.value===null&&!allowNull)throw error(info,'Fonte com valor nulo');return cell.value;};
 const number=(cell,info)=>{const v=present(cell,info);if(typeof v!=='number'||!Number.isFinite(v))throw error(info,'Fonte não numérica ou não finita');return v;};
 const boolean=(cell,info)=>{const v=present(cell,info);if(typeof v!=='boolean')throw error(info,'Fonte deve ser Sim/Não');return v;};
 const list=(cell,info)=>{const v=present(cell,info);if(!Array.isArray(v))throw error(info,'Lista ou coleção exigida');if(v.length>10000)throw error(info,'Lista excede limite de consulta');return v;};
 const indexFor=(source,info)=>{
  let index=indices.get(source.value);if(index)return index;index=new Map();for(const entry of list(source,info)){charge(1);if(!entry||typeof entry.id!=='string'||index.has(entry.id))throw error(info,'Identidade de entrada ausente ou duplicada');index.set(entry.id,entry);}indices.set(source.value,index);return index;
 };
 const callbackFrame=(source,item,i,query,frame)=>{
  const itemCell=source.cells?.[i]??{present:true,value:item,definition:source.definition,dataContext:source.dataContext??frame.dataContext,storageScope:source.storageScope};
  let context=itemCell.dataContext??frame.dataContext;
  if(source.storageScope==='character'&&source.definition?.type==='collection')context={entries:[...(context.entries||[]),{dataId:source.definition.id,entryId:item.id}]};
  const items=new Map(frame.items);items.set(query,{cell:{...itemCell,dataContext:context},token:JSON.stringify([source.definition?.id,item?.id??i,context])});return {dataContext:context,items};
 };
 const visit=(record,info,frame)=>{
  charge();const key=keyFor(record,info,frame);if(memo.has(key))return memo.get(key);const n=info.node,child=p=>visit(record,record.nodes.get(n[p].id),frame),type=compiled.types.get(record.rule.id+':'+n.id);let cell;
  if(n.op==='literal')cell={present:true,value:n.value};
  else if(n.op==='trait')cell={present:true,value:structuredClone(n.dice),definition:type.definition};
  else if(n.op==='traitDice')cell={present:true,value:structuredClone(list(child('value'),info)),storageScope:'temporary'};
  else if(n.op==='input'||n.op==='local'){
   const key=n[n.op==='input'?'inputId':'localId'],values=n.op==='input'?actionInputs:actionLocals,definition=type.definition??{type:type.type,nullable:type.nullable},exists=Object.hasOwn(values,key);if(exists){const issue=typedValueIssue(definition,values[key]);if(issue)throw error(info,issue);}cell={present:exists,...(exists?{value:values[key]}:{}),definition,storageScope:'action',dataContext:frame.dataContext};
  }
  else if(n.op==='read'){
   const context=contextFor(record,info,frame),base=readData(system,character,n.dataId,context);const definition=compiled.rows.find(r=>r.definition.id===n.dataId).definition;readings.set(JSON.stringify([n.dataId,context]),{dataId:n.dataId,context:structuredClone(context),cell:structuredClone(base)});cell=n.mode==='effective'?projectTypedTarget(projectionSystem,character,{kind:'data',dataId:n.dataId},base,{budget:shared,projectionStack,onEffectUse,onRead:reading=>readings.set(JSON.stringify([reading.dataId,reading.context]),structuredClone(reading))}).cell:base;cell={...cell,definition,dataContext:context,storageScope:'character'};
  }else if(n.op==='option')cell={present:true,value:n.optionId,definition:type.definition};
  else if(n.op==='empty')cell={present:true,value:[],definition:type.definition,dataContext:frame.dataContext,storageScope:'character'};
  else if(n.op==='catalog'){
   const catalog=system.catalogs.find(c=>c.id===n.catalogId),issue=typedValueIssue({type:'collection',fields:catalog.fields},catalog.entries);if(issue)throw error(info,issue);cell={present:true,value:catalog.entries,definition:catalog,storageScope:'system',dataContext:frame.dataContext};
  }else if(n.op==='rule'){
   const target=compiled.index.get(n.ruleId),key=n.mode==='effective'&&['number','integer'].includes(type.type)?ruleCalculationKey(system,n.ruleId,frame.dataContext):null,fixed=key?getCalculationOverride(character,key):null;
   if(fixed?.mode==='fixed')cell={present:true,value:fixed.value};
   else {cell=visit(target,target.nodes.get(target.rule.expression.id),frame);if(n.mode==='effective')cell=projectTypedTarget(projectionSystem,character,{kind:'rule',ruleId:n.ruleId},cell,{budget:shared,projectionStack,onEffectUse,onRead:reading=>readings.set(JSON.stringify([reading.dataId,reading.context]),structuredClone(reading))}).cell;if(key)cell={...cell,value:calculationValue(character,key,number(cell,info),{system})};}
  }else if(n.op==='node')cell=visit(record,record.nodes.get(n.nodeId),frame);
  else if(n.op==='item')cell=frame.items.get(info.scopes.at(-1))?.cell;
  else if(n.op==='property'){
   const owner=child('value'),value=present(owner,info),field=owner.definition.fields.find(f=>f.id===n.fieldId);if(!value||typeof value!=='object'||Array.isArray(value))throw error(info,'Registro exigido');const exists=Object.hasOwn(value,field.binding);if(exists){const issue=typedValueIssue(field,value[field.binding]);if(issue)throw error(info,issue);}cell={present:exists,...(exists?{value:value[field.binding]}:{}),definition:field,dataContext:owner.dataContext,storageScope:owner.storageScope};
  }else if(n.op==='lookup'){
   const source=child('source'),id=present(child('key'),info),entry=indexFor(source,info).get(id);charge();if(!entry)throw error(info,'Identidade '+id+' inexistente ou ambígua');cell={present:true,value:entry,definition:source.definition,storageScope:source.storageScope,dataContext:source.storageScope==='character'?{entries:[...(source.dataContext?.entries||[]),{dataId:source.definition.id,entryId:entry.id}]}:frame.dataContext};
  }else if(n.op==='filter'||n.op==='map'||n.op==='any'||n.op==='all'){
   const source=child('source'),values=list(source,info),selected=[],cells=[];let outcome=n.op==='all';
   for(const [i,item]of values.entries()){
    charge(1);const current=callbackFrame(source,item,i,n.id,frame),result=visit(record,record.nodes.get(n[QUERY_PORTS[n.op]].id),current);
    if(n.op==='map'){selected.push(present(result,info));cells.push({...result,dataContext:result.dataContext??current.dataContext});continue;}
    const yes=boolean(result,info);if(n.op==='filter'){if(yes){selected.push(item);if(source.cells)cells.push(source.cells[i]);}}else if(n.op==='any'&&yes||n.op==='all'&&!yes){outcome=yes;break;}
   }
   cell=n.op==='filter'?{...source,value:selected,...(source.cells?{cells}:{})}:n.op==='map'?{present:true,value:selected,cells}:{present:true,value:outcome};
  }else if(['sum','count','min','max'].includes(n.op)){
   const values=list(child('source'),info);let value=n.op==='count'?values.length:0;if(n.op!=='count')for(const [i,v]of values.entries()){charge(1);if(typeof v!=='number'||!Number.isFinite(v))throw error(info,'Lista contém valor não numérico');value=n.op==='sum'?value+v:i===0?v:n.op==='min'?Math.min(value,v):Math.max(value,v);}cell=['min','max'].includes(n.op)&&!values.length?{present:false}:{present:true,value};
  }else if(n.op==='ifAbsent'){const value=child('value');cell=value.present?value:child('fallback');}
  else if(n.op==='ifNull'){const value=child('value');cell=value.present&&value.value===null?child('fallback'):value;}
  else if(n.op==='if')cell=child(boolean(child('condition'),info)?'then':'else');
  else if(n.op==='exists')cell={present:true,value:child('value').present};
  else if(n.op==='isNull'){const value=child('value');cell={present:true,value:value.present&&value.value===null};}
  else if(n.op==='isEmpty'){const value=child('value');cell={present:true,value:value.present&&(value.value===''||Array.isArray(value.value)&&value.value.length===0||value.value!==null&&typeof value.value==='object'&&!Array.isArray(value.value)&&Object.keys(value.value).length===0)};}
  else if(n.op==='resolved'){const value=child('value');cell={present:true,value:value.present&&value.value!==null&&(!Array.isArray(value.value)||value.value.length>0)&&!referenceValueIssue(system,character,value.definition,value.value,value.dataContext??frame.dataContext)};}
  else if(n.op==='and'||n.op==='or'){const a=boolean(child('left'),info);cell={present:true,value:n.op==='and'?a&&boolean(child('right'),info):a||boolean(child('right'),info)};}
  else if(n.op==='not')cell={present:true,value:!boolean(child('value'),info)};
  else if(n.op==='equal'){const a=present(child('left'),info,true),b=present(child('right'),info,true),canonical=v=>Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;cell={present:true,value:typeof a===typeof b&&JSON.stringify(canonical(a))===JSON.stringify(canonical(b))};}
  else if(n.op==='text'){const source=child('value'),value=present(source,info);cell={present:true,value:typeof value==='boolean'?value?'Sim':'Não':source.definition?.type==='enum'?source.definition.options.find(o=>o.id===value).label:String(value)};}
  else if(n.op==='concat'){const a=present(child('left'),info),b=present(child('right'),info);if(typeof a!=='string'||typeof b!=='string')throw error(info,'Textos exigidos');cell={present:true,value:a+b};}
  else {
   const a=number(child(n.op==='floor'||n.op==='abs'?'value':'left'),info),b=n.op==='floor'||n.op==='abs'?undefined:number(child('right'),info);let value;
   if(n.op==='divide'&&b===0)throw error(info,'Divisão por zero');
   switch(n.op){case'add':value=a+b;break;case'subtract':value=a-b;break;case'multiply':value=a*b;break;case'divide':value=a/b;break;case'floor':value=Math.floor(a);break;case'abs':value=Math.abs(a);break;case'less':value=a<b;break;case'lessEqual':value=a<=b;break;case'greater':value=a>b;break;case'greaterEqual':value=a>=b;break;default:throw error(info,'Operação indisponível');}cell={present:true,value};
  }
  if(!cell)throw error(info,'Contexto de entrada indisponível');if(cell.present&&typeof cell.value==='number'&&!Number.isFinite(cell.value))throw error(info,'Resultado não finito');if(cell.present&&typeof cell.value==='string'&&cell.value.length>RULE_LIMITS.string)throw error(info,'Texto excede limite');
  cell={...cell,type};memo.set(key,cell);if(trace&&traceRows.length<500)traceRows.push({nodeId:n.id,operation:n.op,path:info.path,label:RULE_OPERATIONS[n.op].label,value:summary(cell),entries:structuredClone(frame.dataContext.entries||[])});return cell;
 };
 const evaluate=(id,currentContext=dataContext)=>{
  const record=compiled.index.get(id);if(!record)throw Error('Cálculo indisponível: '+id);for(const dataId of record.contextCollections)if(!currentContext.entries?.some(e=>e.dataId===dataId))throw Error(record.rule.label+': contexto de entrada ausente');
  const cell=visit(record,record.nodes.get(record.rule.expression.id),{dataContext:currentContext,items:new Map()}),value=present(cell,record.nodes.get(record.rule.expression.id),record.rule.id===actionScope?.ruleId);if(record.rule.resultType==='number'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Resultado não numérico');if(['string','boolean'].includes(record.rule.resultType)&&typeof value!==record.rule.resultType)throw Error('Tipo de resultado incompatível');if(record.rule.id===actionScope?.ruleId&&!['infer','number','string','boolean','null'].includes(record.rule.resultType)){const issue=typedValueIssue(cell.definition,value);if(issue)throw Error(issue);}if(record.rule.resultType==='null'&&value!==null)throw Error('null explícito exigido.');return structuredClone(value);
 };
 return {system,character,compiled,evaluate,project:(target,cell)=>projectTypedTarget(projectionSystem,character,target,cell,{budget:shared,projectionStack,onEffectUse,onRead:reading=>readings.set(JSON.stringify([reading.dataId,reading.context]),structuredClone(reading))}),trace:traceRows,readings,metrics:()=>({steps,visits}),invalidate(){memo.clear();indices=new WeakMap();traceRows.length=0;readings.clear();steps=0;visits=0;if(!budget)shared.remaining=100000;checkCharacter();}};
}
export function evaluateRule(system,character,id,options={}){
 const context=options.ruleEvaluation??createRuleContext(system,character,options);if(context.system!==system||context.character!==character)throw Error('Contexto de avaliação pertence a outra revisão');let value=context.evaluate(id,options.dataContext);if(options.projected)value=context.project({kind:'rule',ruleId:id},{present:true,value}).cell.value;for(const reading of context.readings.values())options.onRead?.(reading);return value;
}
