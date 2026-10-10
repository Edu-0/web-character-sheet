import {pathKeys} from '../engine/paths.js';
import {DATA_TYPES, BOUND_COMPONENT_TYPES, readData, valueIssue} from '../engine/data-definitions.js';
import {RULE_OPERATIONS, RULE_LIMITS} from '../engine/rule-registry.js';
const object=v=>v!==null && typeof v==='object' && !Array.isArray(v);
const id=v=>typeof v==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v) && !['constructor','prototype','__proto__'].includes(v);
export function validateDataDefinitions(system, character=system.characterTemplate, root='system.characterTemplate') {
  const issues=[], add=(path,message)=>issues.push({path,message,code:'data.invalid'}), definitions=system.dataDefinitions;
  if (definitions===undefined) return issues;
  if(system.schemaVersion!==3)return issues; // Legacy unknown roots keep their previous meaning.
  if(!Array.isArray(definitions) || definitions.length>500) {add('system.dataDefinitions','lista de até 500 dados exigida');return issues;}
  const ids=new Set(), bindings=[];
  definitions.forEach((d,i)=>{
    const at=`system.dataDefinitions[${i}]`;
    if(!object(d)) {add(at,'definição deve ser objeto');return;}
    if(!id(d.id) || ids.has(d.id)) add(at+'.id','identidade inválida ou duplicada');ids.add(d.id);
    if(typeof d.label!=='string' || !d.label.trim()) add(at+'.label','informe o nome');
    if(!DATA_TYPES.includes(d.type)) add(at+'.type','tipo indisponível neste recorte');
    for(const key of ['required','nullable']) if(typeof d[key]!=='boolean') add(at+'.'+key,'booleano explícito exigido');
    if(d.description!==undefined && typeof d.description!=='string') add(at+'.description','deve ser texto');
    // Unsupported executable/restriction options must not look functional.
    for(const key of Object.keys(d)) if(!['id','label','description','type','binding','required','nullable','initial','extensions'].includes(key)) add(at+'.'+key,'opção de dado indisponível; metadados seguros pertencem a extensions');
    try {
      const keys=pathKeys(d.binding);
      if(['schemaVersion','meta','activeEffects','calculationOverrides'].includes(keys[0])) throw new Error('Binding reservado ao documento');
      if(bindings.some(b=>b===d.binding || b.startsWith(d.binding+'.') || d.binding.startsWith(b+'.'))) throw new Error('Binding sobreposto a outra identidade');
      bindings.push(d.binding);
      if(Object.hasOwn(d,'initial')) {const problem=valueIssue(d,d.initial);if(problem)add(at+'.initial',problem);}
      const cell=readData(system,character,d.id);
      if(d.required && !cell.present && !(character===system.characterTemplate && Object.hasOwn(d,'initial'))) add(root+'.'+d.binding,'dado obrigatório ausente');
      // An existing scalar parent cannot be replaced during an interaction.
      let owner=character;for(const key of keys.slice(0,-1)){if(owner==null)break;if(typeof owner!=='object' || Array.isArray(owner))throw new Error('Binding atravessa valor não estruturado');owner=Object.hasOwn(owner,key)?owner[key]:undefined;}
      if(owner!==undefined && (owner===null || typeof owner!=='object' || Array.isArray(owner))) throw new Error('Binding atravessa valor não estruturado');
    } catch(error) {add(at+'.binding',error.message);}
  });
  return issues;
}
export function validateRules(system) {
  const issues=[],add=(path,message)=>issues.push({path,message,code:'rule.invalid'});
  if(system.rules===undefined)return issues;
  if(system.schemaVersion!==3)return issues; // Declarative rules are interpreted only in v3.
  if(!Array.isArray(system.rules) || system.rules.length>RULE_LIMITS.rules){add('system.rules','lista de até 100 cálculos exigida');return issues;}
  const ids=new Set();
  system.rules.forEach((rule,i)=>{
    const at=`system.rules[${i}]`;
    if(!object(rule)){add(at,'regra deve ser objeto');return;}
    if(!id(rule.id) || ids.has(rule.id))add(at+'.id','identidade inválida ou duplicada');ids.add(rule.id);
    if(rule.kind!=='calculation' || rule.resultType!=='number')add(at,'somente cálculo numérico disponível');
    if(!Number.isSafeInteger(rule.revision) || rule.revision<1)add(at+'.revision','revisão positiva exigida');
    if(typeof rule.label!=='string' || !rule.label.trim())add(at+'.label','nome exigido');
    for(const key of Object.keys(rule))if(!['id','label','revision','kind','resultType','expression','extensions'].includes(key))add(at+'.'+key,'opção de regra indisponível');
    let count=0;const nodes=new Set();
    const visit=(node,path,depth=0)=>{
      if(++count>RULE_LIMITS.nodes || depth>RULE_LIMITS.depth){add(path,'limite de cálculo excedido');return;}
      if(!object(node)){add(path,'nó deve ser objeto');return;}
      if(!id(node.id) || nodes.has(node.id))add(path+'.id','ID de nó inválido ou duplicado');nodes.add(node.id);
      const operation=Object.hasOwn(RULE_OPERATIONS,node.op)?RULE_OPERATIONS[node.op]:null;
      if(!operation || node.version!==1){add(path+'.op','operação/versão indisponível');return;}
      const allowed=['id','op','version','extensions',...operation.inputs,...(node.op==='literal'?['value']:node.op==='read'?['dataId']:[])];
      for(const key of Object.keys(node))if(!allowed.includes(key))add(path+'.'+key,'parâmetro indisponível');
      if(node.op==='literal' && (typeof node.value!=='number' || !Number.isFinite(node.value)))add(path+'.value','número finito exigido');
      if(node.op==='read') {const d=(Array.isArray(system.dataDefinitions)?system.dataDefinitions:[]).find(d=>d?.id===node.dataId);if(!d || !['number','integer'].includes(d.type))add(path+'.dataId','fonte numérica inexistente ou incompatível');}
      for(const key of operation.inputs)visit(node[key],path+'.'+key,depth+1);
    };visit(rule.expression,at+'.expression');
  });return issues;
}
export function validateBinding(component, system, path, layoutVersion) {
  const issues=[],add=(key,message)=>issues.push({path:path+'.'+key,message,code:'binding.invalid'});
  if(component.dataId!==undefined){
    if(!Object.hasOwn(BOUND_COMPONENT_TYPES,component.type))add('dataId','consumidor não admite vínculo tipado');
    if(layoutVersion!==3 || system && system.schemaVersion!==3)add('dataId','vínculo exige layout e sistema v3');
    const d=(Array.isArray(system?.dataDefinitions)?system.dataDefinitions:[]).find(d=>d?.id===component.dataId);
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
