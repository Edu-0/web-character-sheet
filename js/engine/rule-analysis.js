import {RULE_OPERATIONS,RULE_LIMITS} from './rule-operations.js';
import {dataDefinitions} from './data-definitions.js';
import {typedValueIssue} from './data-types.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const safeId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
export const QUERY_PORTS=Object.freeze({filter:'predicate',map:'value',mapEntries:'value',any:'predicate',all:'predicate'});
const numeric=t=>['number','integer'].includes(t?.type);
export const sameRuleType=(a,b)=>numeric(a)&&numeric(b)||a?.type===b?.type&&(!['record','collection','enum','reference','trait'].includes(a?.type)||a.definition?.id===b.definition?.id)&&(!a?.item||sameRuleType(a.item,b.item));
export function typeOfDefinition(definition){return {type:definition.type,definition,optional:!definition.required,nullable:definition.nullable,...(definition.type==='collection'?{item:{type:'record',definition,collectionEntry:true,collectionIds:[definition.id]}}:{})};}
export function compileRules(system,{actionScope}={}){
 if(system?.schemaVersion!==3)throw Error('Regras declarativas exigem v3.');
 const rules=system.rules??[];if(!Array.isArray(rules)||rules.length>RULE_LIMITS.rules+(actionScope?1:0))throw Error('Lista de até '+RULE_LIMITS.rules+' regras exigida');
 const rows=dataDefinitions(system),index=new Map(),types=new Map(),active=new Set(),dependencies=new Map();let total=0;
 const fail=(info,port,message)=>{const error=Error((info?.rule?.label||'Regra')+' › '+(RULE_OPERATIONS[info?.node?.op]?.label||'Parte')+(port?' › '+port:'')+': '+message);error.path=(info?.path||'system.rules')+(port?'.'+port:'');error.nodeId=info?.node?.id;throw error;};
 for(const [i,rule]of rules.entries()){
  const at='system.rules['+i+']';if(!object(rule)||!safeId(rule.id)||index.has(rule.id))fail({rule,path:at},'id','identidade inválida ou duplicada');
  const actionExpression=rule.id===actionScope?.ruleId;
  if(!['calculation','predicate'].includes(rule.kind)||!(actionExpression?['infer','number','integer','string','boolean','null','enum','reference','trait','record','collection']:['number','string','boolean']).includes(rule.resultType)||rule.kind==='predicate'&&rule.resultType!=='boolean')fail({rule,path:at},'kind','espécie ou resultado indisponível');
  if(!Number.isSafeInteger(rule.revision)||rule.revision<1||typeof rule.label!=='string'||!rule.label.trim())fail({rule,path:at},'revision','nome e revisão positiva exigidos');
  if(Object.keys(rule).some(k=>!['id','label','revision','kind','resultType','context','expression','extensions'].includes(k)))fail({rule,path:at},null,'parâmetro de regra indisponível');
  let contextCollections=[];if(rule.context!==undefined){const row=rows.find(r=>r.definition.id===rule.context?.dataId);if(!object(rule.context)||Object.keys(rule.context).some(k=>k!=='dataId')||row?.definition.type!=='collection')fail({rule,path:at},'context','selecione coleção para o contexto da entrada');contextCollections=[...row.ancestors.filter(d=>d.type==='collection').map(d=>d.id),row.definition.id];}
  const record={rule,nodes:new Map(),path:at,contextCollections};index.set(rule.id,record);dependencies.set(rule.id,{dataIds:new Set(contextCollections),ruleIds:new Set(),catalogIds:new Set()});
  const collect=(node,path,scopes=[],depth=0)=>{
   const info={node,rule,path,scopes};if(++total>100000||record.nodes.size>=RULE_LIMITS.nodes||depth>RULE_LIMITS.depth)fail(info,null,'limite de árvore excedido');
   if(!object(node)||!safeId(node.id)||record.nodes.has(node.id))fail(info,'id','identidade de parte inválida ou duplicada');
   const operation=Object.hasOwn(RULE_OPERATIONS,node.op)?RULE_OPERATIONS[node.op]:null;
   if(!operation||node.version!==1)fail(info,'op','operação/versão indisponível');
   if(operation.scope==='action'&&!actionExpression)fail(info,'op','fonte disponível somente dentro de ação explícita');
   if(Object.keys(node).some(k=>!['id','op','version','extensions',...operation.inputs,...operation.parameters].includes(k)))fail(info,null,'parâmetro indisponível');
   record.nodes.set(node.id,info);
   if(node.op==='literal'&&!(node.value===null||typeof node.value==='boolean'||typeof node.value==='string'&&node.value.length<=RULE_LIMITS.string||typeof node.value==='number'&&Number.isFinite(node.value)))fail(info,'value','literal primitivo finito exigido');
   for(const p of operation.parameters)if(p!=='value'&&!(node.op==='trait'&&p==='dice')&&!(['rule','read'].includes(node.op)&&p==='mode'))if(!safeId(node[p]))fail(info,p,'identidade exigida');
   if(node.op==='trait'){const definition=rows.find(r=>r.definition.id===node.dataId)?.definition;if(definition?.type!=='trait')fail(info,'dataId','escolha um traço existente');const issue=typedValueIssue(definition,node.dice);if(issue)fail(info,'dice',issue);}
   if(node.op==='read'&&node.mode!==undefined&&!['base','effective'].includes(node.mode))fail(info,'mode','escolha base ou efetivo');
   if(node.op==='rule'&&node.mode!==undefined&&!['automatic','effective'].includes(node.mode))fail(info,'mode','escolha automático ou efetivo');
   for(const p of operation.inputs)collect(node[p],path+'.'+p,QUERY_PORTS[node.op]===p?[...scopes,node.id]:scopes,depth+1);
  };collect(rule.expression,at+'.expression');
 }
 const infer=(record,info)=>{
  const cache=record.rule.id+':'+info.node.id;if(types.has(cache))return types.get(cache);if(active.has(cache))fail(info,null,'dependência cíclica');if(active.size>=RULE_LIMITS.dependencyDepth)fail(info,null,'limite de profundidade de dependências excedido');active.add(cache);
  const n=info.node,op=RULE_OPERATIONS[n.op],child=p=>infer(record,record.nodes.get(n[p].id)),need=(t,k,p)=>{if(!(k==='number'?numeric(t):t?.type===k))fail(info,p,'exige '+k+', recebeu '+(t?.type||'indisponível'));return t;};
  const scopeTypes=()=>info.scopes.map(id=>{const query=record.nodes.get(id);return childSource(record,query);});
  let result;
  if(n.op==='literal')result={type:n.value===null?'null':typeof n.value,nullable:n.value===null,optional:false};
  else if(n.op==='input'||n.op==='local'){
   const definition=(n.op==='input'?actionScope?.inputs:actionScope?.locals)?.find(d=>d.id===n[n.op==='input'?'inputId':'localId']);if(!definition)fail(info,null,n.op==='input'?'entrada da ação inexistente':'resultado ainda não produzido nesta etapa');result=definition.valueType??typeOfDefinition(definition);
  }
  else if(n.op==='trait'){result=typeOfDefinition(rows.find(r=>r.definition.id===n.dataId).definition);result.optional=false;result.nullable=false;}
  else if(n.op==='traitDice'){need(child('value'),'trait','value');result={type:'list',item:{type:'number',optional:false,nullable:false},optional:false,nullable:false};}
  else if(n.op==='stepCost'){
   need(child('from'),'number','from');need(child('to'),'number','to');const definition=rows.find(row=>row.definition.id===n.dataId)?.definition,catalog=system.catalogs?.find(catalog=>catalog.id===n.catalogId);
   if(definition?.type!=='trait'||!catalog)fail(info,null,'escolha escala de traço e catálogo existentes');
   const fields=['fromFieldId','toFieldId','costFieldId'].map(key=>catalog.fields.find(field=>field.id===n[key]));if(new Set(fields).size!==3||fields.some(field=>!field||!['number','integer'].includes(field.type)))fail(info,null,'escolha três campos numéricos distintos do catálogo');
   dependencies.get(record.rule.id).dataIds.add(n.dataId);dependencies.get(record.rule.id).catalogIds.add(catalog.id);result={type:'number',optional:false,nullable:false};
  }
  else if(n.op==='read'||n.op==='empty'){
   const row=rows.find(r=>r.definition.id===n.dataId);if(!row)fail(info,'dataId','dado inexistente');
   const scopes=[...record.contextCollections,...scopeTypes().flatMap(t=>t.item?.collectionIds||[])];for(const a of row.ancestors)if(a.type==='collection'&&!scopes.includes(a.id))fail(info,'dataId',row.definition.label+' exige entrada de '+a.label);
   result=typeOfDefinition(row.definition);if(result.item)result={...result,item:{...result.item,collectionIds:[...row.ancestors.filter(d=>d.type==='collection').map(d=>d.id),row.definition.id]}};if(n.op==='empty'){need(result,'collection','dataId');result={...result,optional:false,nullable:false};}dependencies.get(record.rule.id).dataIds.add(n.dataId);
  }else if(n.op==='option'){
   const row=rows.find(r=>r.definition.id===n.dataId);if(row?.definition.type!=='enum'||!row.definition.options?.some(o=>o.id===n.optionId))fail(info,'optionId','opção de escolha inexistente');result=typeOfDefinition(row.definition);result.optional=false;result.nullable=false;dependencies.get(record.rule.id).dataIds.add(n.dataId);
  }else if(n.op==='catalog'){
   const catalog=system.catalogs?.find(c=>c.id===n.catalogId);if(!catalog)fail(info,'catalogId','catálogo inexistente');result={type:'collection',definition:catalog,item:{type:'record',definition:catalog,collectionEntry:true},optional:false,nullable:false};dependencies.get(record.rule.id).catalogIds.add(catalog.id);
  }else if(n.op==='rule'){
   const target=index.get(n.ruleId);if(!target)fail(info,'ruleId','cálculo inexistente');const scopes=[...record.contextCollections,...scopeTypes().flatMap(t=>t.item?.collectionIds||[])];if(target.contextCollections.some(id=>!scopes.includes(id)))fail(info,'ruleId','cálculo exige contexto de entrada compatível');result=infer(target,target.nodes.get(target.rule.expression.id));if(target.rule.resultType!==result.type&&!(target.rule.resultType==='number'&&numeric(result)))fail(info,'ruleId','tipo de saída incompatível');if(n.mode==='effective'&&!['number','integer','string','boolean'].includes(result.type))fail(info,'mode','resultado escalar exigido');dependencies.get(record.rule.id).ruleIds.add(n.ruleId);
  }else if(n.op==='node'){
   const target=record.nodes.get(n.nodeId);if(!target)fail(info,'nodeId','parte inexistente');if(target.scopes.some(id=>!info.scopes.includes(id)))fail(info,'nodeId','parte pertence a outro contexto de entrada');result=infer(record,target);
  }else if(n.op==='item'){
   const source=scopeTypes().at(-1);if(!source)fail(info,null,'exige contexto de entrada');result=source.item;
  }else if(n.op==='property'){
   const value=need(child('value'),'record','value'),field=value.definition?.fields?.find(f=>f.id===n.fieldId);if(!field)fail(info,'fieldId','campo não pertence ao registro');result=typeOfDefinition(field);if(result.item)result={...result,item:{...result.item,collectionIds:[...(value.collectionIds||[]),field.id]}};else if(result.type==='record')result={...result,collectionIds:value.collectionIds};
  }else if(n.op==='entryReference'){
   const value=need(child('value'),'record','value'),definition=rows.find(row=>row.definition.id===n.dataId)?.definition;if(!value.collectionEntry)fail(info,'value','referência exige entrada de coleção, não registro comum');if(definition?.type!=='reference'||definition.multiple)fail(info,'dataId','escolha referência singular existente');if((definition.target?.dataId??definition.target?.catalogId)!==value.definition?.id)fail(info,'value','destino de referência incompatível');dependencies.get(record.rule.id).dataIds.add(definition.id);if(definition.target.scope==='character')dependencies.get(record.rule.id).dataIds.add(definition.target.dataId);else dependencies.get(record.rule.id).catalogIds.add(definition.target.catalogId);result={...typeOfDefinition(definition),optional:value.optional,nullable:false};
  }else if(n.op==='withField'){
   const owner=need(child('value'),'record','value'),field=owner.definition?.fields?.find(field=>field.id===n.fieldId);if(!field)fail(info,'fieldId','campo não pertence ao registro');const replacement=child('replacement');if(!sameRuleType(replacement,typeOfDefinition(field))&&!(replacement.type==='null'&&field.nullable))fail(info,'replacement','tipo nominal incompatível com campo');result=owner;
  }else if(n.op==='flatten'){
   const source=need(child('source'),'list','source');need(source.item,'list','source');result={type:'list',item:source.item.item,optional:false,nullable:false};
  }else if(n.op==='mapEntries'){
   const source=need(child('source'),'collection','source'),body=need(child('value'),'record','value');if(!body.collectionEntry||!sameRuleType(source.item,body))fail(info,'value','preserve o tipo nominal da entrada');result={...source,optional:false,nullable:false};
  }else if(n.op==='entryIdentity'){
   const value=need(child('value'),'record','value');if(!value.collectionEntry)fail(info,'value','identidade exige entrada de coleção, não registro comum');result={type:'string',optional:value.optional,nullable:false};
  }else if(n.op==='only'||n.op==='first'){
   const source=need(child('source'),'collection','source');result={...source.item,optional:n.op==='first',nullable:false};
  }else if(n.op==='lookup'){
   const source=need(child('source'),'collection','source'),key=child('key');if(key.type==='reference'){if(key.definition.multiple)fail(info,'key','referência singular exigida');const target=key.definition.target;if((target.catalogId??target.dataId)!==source.definition.id)fail(info,'key','destino de referência incompatível');}else need(key,'string','key');result={...source.item,optional:false};
  }else if(n.op==='filter'||n.op==='map'||n.op==='any'||n.op==='all'){
   const source=child('source');if(!['collection','list'].includes(source.type))fail(info,'source','lista ou coleção exigida');const body=child(QUERY_PORTS[n.op]);if(n.op!=='map')need(body,'boolean',QUERY_PORTS[n.op]);result=n.op==='filter'?source:n.op==='map'?{type:'list',item:body,optional:false,nullable:false}:{type:'boolean',optional:false,nullable:false};
  }else if(['sum','min','max','count'].includes(n.op)){
   const source=child('source');if(!['collection','list'].includes(source.type))fail(info,'source','lista ou coleção exigida');if(n.op!=='count')need(source.item,'number','source');result={type:'number',optional:['min','max'].includes(n.op),nullable:false};
  }else if(['ifAbsent','ifNull','if'].includes(n.op)){
   if(n.op==='if')need(child('condition'),'boolean','condition');const a=child(n.op==='if'?'then':'value'),b=child(n.op==='if'?'else':'fallback');if(!sameRuleType(a,b)&&!(n.op==='ifNull'&&a.type==='null'))fail(info,null,'ramos exigem tipos compatíveis');result={...(a.type==='null'?b:a),optional:n.op==='ifAbsent'?Boolean(b.optional):Boolean(a.optional||b.optional),nullable:n.op==='ifNull'?Boolean(b.nullable):Boolean(a.nullable||b.nullable)};
  }else if(n.op==='resolved'){need(child('value'),'reference','value');result={type:'boolean',optional:false,nullable:false};
  }else if(['exists','isNull','isEmpty'].includes(n.op)){child('value');result={type:'boolean',optional:false,nullable:false};
  }else if(n.op==='equal'){
   const a=child('left'),b=child('right');if(!sameRuleType(a,b)&&!(a.type==='null'&&b.nullable||b.type==='null'&&a.nullable))fail(info,null,'comparação exige o mesmo tipo');result={type:'boolean',optional:false,nullable:false};
  }else{
   const required=['and','or','not'].includes(n.op)?'boolean':n.op==='concat'?'string':n.op==='text'?null:'number';
   for(const p of op.inputs){const t=child(p);if(required)need(t,required,p);else if(!['number','integer','boolean','string','enum'].includes(t.type))fail(info,p,'conversão para texto admite somente valores primitivos');}
   result={type:op.resultType,optional:false,nullable:false};
  }
  types.set(cache,result);active.delete(cache);return result;
 };
 const childSource=(record,info)=>infer(record,record.nodes.get(info.node.source.id));
 for(const record of index.values()){
  const result=infer(record,record.nodes.get(record.rule.expression.id));if(record.rule.resultType!=='infer'&&result.type!==record.rule.resultType&&!(record.rule.resultType==='number'&&numeric(result)))fail(record.nodes.get(record.rule.expression.id),null,'resultado declarado '+record.rule.resultType+' incompatível com '+result.type);
  // Lazy branches remain executable only when their complete graph is admitted.
  for(const info of record.nodes.values())infer(record,info);
 }
 return {index,types,dependencies,rows,total};
}
