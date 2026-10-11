import {RULE_OPERATIONS,createRuleContext} from '../engine/rule-registry.js';
import {initializeData,dataDefinitions} from '../engine/data-definitions.js';
import {valueAt} from './form-structure.js';
import {ruleNode,stepRecipe} from './typed-data-commands.js';
import {numberFromText} from './form-commands.js';
import {el,button,choose,input} from './authoring-dom.js';
import {compileActionExpression} from '../engine/action-expression.js';
const portLabels={left:'Editar primeiro operando tipado',right:'Editar segundo operando tipado',value:'Editar valor tipado',fallback:'Editar alternativa se ausente',condition:'Editar condição tipada',then:'Editar ramo verdadeiro tipado',else:'Editar ramo falso tipado',source:'Editar coleção fonte tipada',predicate:'Editar condição desta entrada',key:'Editar identidade procurada'};
const title=row=>row.ancestors.map(d=>d.label).concat(row.definition.label).join(' › ');
export function mountTypedRuleBuilder(host,{pkg,state,expression,resultType='number',kind='calculation',context,actionScope,onEdit=()=>{},onApply}){
 state.ast??=structuredClone(expression||ruleNode());state.selection??=[];state.rawValues??={};state.errors??={};state.resultType??=resultType;state.kind??=kind;state.contextDataId??=context?.dataId||'';
 const sources=dataDefinitions(pkg.system),fields=[...sources,...(pkg.system.catalogs||[]).flatMap(c=>{const rows=[],walk=(list,ancestors)=>{for(const definition of list){rows.push({definition,ancestors});if(definition.fields)walk(definition.fields,[...ancestors,definition]);}};walk(c.fields,[c]);return rows;})];
 if(actionScope){const walk=(definitions,ancestors=[])=>{for(const definition of definitions){fields.push({definition,ancestors});if(definition.fields)walk(definition.fields,[...ancestors,definition]);}};walk(actionScope.inputs||[]);walk((actionScope.locals||[]).filter(l=>l.valueType?.definition).map(l=>l.valueType.definition));}
 const changed=()=>{state.dirty=true;onEdit(state);};
 const render=()=>{
  host.replaceChildren(el('h4','Construir cálculo tipado'),el('p','Escolha fontes, operações e contexto. Ausência, null e valores vazios têm tratamentos explícitos; consultas são limitadas e não alteram a ficha.','editor-note'));
  const purpose=choose('Função da regra tipada',[['calculation','Calcular valor'],['predicate','Condição reutilizável']],state.kind);if(!actionScope)host.append(purpose.wrap);purpose.input.addEventListener('change',()=>{state.kind=purpose.input.value;if(state.kind==='predicate')state.resultType='boolean';changed();render();});
  const result=choose('Tipo do resultado tipado',[['number','Número'],['string','Texto'],['boolean','Sim/Não']],state.resultType),scope=choose('Contexto do cálculo tipado',[['','Personagem inteiro'],...sources.filter(r=>r.definition.type==='collection').map(r=>[r.definition.id,'Entrada de '+title(r)])],state.contextDataId||'');if(!actionScope)host.append(result.wrap,scope.wrap);else host.append(el('p','Expressão temporária da ação · resultado '+resultType+'. Entradas e resultados anteriores são somente leituras locais.'));result.input.disabled=state.kind==='predicate';
  result.input.addEventListener('change',()=>{state.resultType=result.input.value;changed();render();});scope.input.addEventListener('change',()=>{state.contextDataId=scope.input.value;changed();render();});
  const recipe=el('details');recipe.append(el('summary','Receita: a cada N, um ponto'));state.recipe??={};
  const recipeSource=choose('Fonte da receita por intervalo',[['','Escolha um dado'],...sources.filter(r=>['number','integer'].includes(r.definition.type)).map(r=>[r.definition.id,title(r)])],state.recipe.source||''),step=input('Intervalo da receita',state.recipe.step??'5'),absence=choose('Fonte ausente na receita',[['error','Mostrar diagnóstico'],['zero','Usar zero explicitamente']],state.recipe.absence||'error');
  for(const [key,c]of [['source',recipeSource],['step',step],['absence',absence]])c.input.addEventListener('input',()=>{state.recipe[key]=c.input.value;onEdit(state);});
  const recipeStatus=el('p');recipeStatus.setAttribute('role','status');recipe.append(recipeSource.wrap,step.wrap,absence.wrap,el('p','Gera Arredondar para baixo → Dividir → fonte e intervalo. Todas as operações continuam editáveis.'),button('Usar receita por intervalo',()=>{
   try{if(Object.keys(state.errors).length)throw Error('Resolva ou descarte o texto inválido antes de usar a receita.');state.ast=stepRecipe({dataId:recipeSource.input.value,step:numberFromText(step.input.value),...(absence.input.value==='zero'?{absentFallback:0}:{})});state.kind='calculation';state.resultType='number';state.selection=[];changed();render();}catch(error){recipeStatus.textContent=error.message;}
  }),recipeStatus);host.append(recipe);
  if(!valueAt(state.ast,state.selection))state.selection=[];
  const node=valueAt(state.ast,state.selection),nav=el('nav');nav.append(button('Cálculo tipado inteiro',()=>{state.selection=[];render();}));if(state.selection.length)nav.append(button('Parte tipada anterior',()=>{state.selection.pop();render();}));host.append(nav);
  const status=el('p');status.setAttribute('role','status');const operation=choose('Operação tipada desta parte',Object.entries(RULE_OPERATIONS).filter(([,v])=>v.scope!=='action'||actionScope).map(([key,v])=>[key,v.label]),node.op);host.append(operation.wrap);
  operation.input.addEventListener('change',()=>{
   if(Object.keys(state.errors).length){status.textContent='Resolva ou descarte o número inválido antes de trocar operações.';return;}
   const next=ruleNode(operation.input.value,node);if(!state.selection.length)state.ast=next;else valueAt(state.ast,state.selection.slice(0,-1))[state.selection.at(-1)]=next;changed();render();
  });
  if(node.op==='literal'){
   const kind=node.value===null?'null':typeof node.value,literalType=choose('Tipo do valor literal tipado',[['number','Número'],['string','Texto'],['boolean','Sim/Não'],['null','null explícito']],kind);host.append(literalType.wrap);
   literalType.input.addEventListener('change',()=>{if(Object.keys(state.errors).length){status.textContent='Resolva ou descarte o número inválido antes de trocar o tipo.';return;}node.value=({number:0,string:'',boolean:false,null:null})[literalType.input.value];changed();render();});
   if(kind!=='null'){
    const key=JSON.stringify(state.selection),value=kind==='boolean'?choose('Sim/Não da operação tipada',[['false','Não'],['true','Sim']],String(node.value)):input(kind==='number'?'Número da operação tipada':'Texto da operação tipada',state.rawValues[key]??String(node.value));host.append(value.wrap);
    value.input.addEventListener('input',()=>{state.rawValues[key]=value.input.value;try{node.value=kind==='number'?numberFromText(value.input.value):kind==='boolean'?value.input.value==='true':value.input.value;delete state.errors[key];delete state.rawValues[key];}catch(error){state.errors[key]=error.message;}changed();status.textContent=Object.values(state.errors).join('; ')||'Alteração pendente; aplique o cálculo.';});
   }
  }
  const parameter=(key,label,choices)=>{const control=choose(label,choices,node[key]||'');host.append(control.wrap);control.input.addEventListener('change',()=>{node[key]=control.input.value;changed();render();});};
  if(['read','empty'].includes(node.op))parameter('dataId','Dado fonte da operação tipada',[['','Escolha um dado'],...sources.filter(r=>node.op!=='empty'||r.definition.type==='collection').map(r=>[r.definition.id,title(r)+' · '+r.definition.type])]);
  if(node.op==='input')parameter('inputId','Entrada temporária da operação',[['','Escolha uma entrada'],...(actionScope?.inputs||[]).map(d=>[d.id,d.label+' · '+d.type])]);
  if(node.op==='local')parameter('localId','Resultado anterior da operação',[['','Escolha um resultado'],...(actionScope?.locals||[]).map(d=>[d.id,d.label+' · '+d.valueType.type])]);
  if(node.op==='option'){
   parameter('dataId','Escolha da operação tipada',[['','Escolha um dado'],...sources.filter(r=>r.definition.type==='enum').map(r=>[r.definition.id,title(r)])]);
   parameter('optionId','Opção da operação tipada',[['','Escolha uma opção'],...(sources.find(r=>r.definition.id===node.dataId)?.definition.options||[]).map(o=>[o.id,o.label])]);
  }
  if(node.op==='catalog')parameter('catalogId','Catálogo fonte da operação tipada',[['','Escolha um catálogo'],...(pkg.system.catalogs||[]).map(c=>[c.id,c.label])]);
  if(node.op==='property')parameter('fieldId','Campo do registro na operação tipada',[['','Escolha um campo'],...fields.filter(r=>r.ancestors.length).map(r=>[r.definition.id,title(r)+' · '+r.definition.type])]);
  if(node.op==='rule'){
   parameter('ruleId','Cálculo usado pela operação tipada',[['','Escolha um cálculo'],...(pkg.system.rules||[]).filter(r=>r.id!==state.ruleId).map(r=>[r.id,r.label+' · '+r.resultType])]);
   parameter('mode','Valor do cálculo usado',[['automatic','Automático'],['effective','Efetivo com ajustes numéricos']]);
  }
  const parts=[];let count=0;const collect=(part,path=[],depth=0)=>{if(!part||depth>32||++count>2048)return;parts.push({part,path});for(const port of RULE_OPERATIONS[part.op]?.inputs||[])collect(part[port],[...path,port],depth+1);};collect(state.ast);
  if(node.op==='node')parameter('nodeId','Parte reutilizada pela operação tipada',[['','Escolha uma parte'],...parts.filter(r=>r.part.id!==node.id).map(r=>[r.part.id,(RULE_OPERATIONS[r.part.op]?.label||r.part.op)+' · '+(r.path.join(' › ')||'Cálculo inteiro')])]);
  if(RULE_OPERATIONS[node.op]?.help)host.append(el('p',RULE_OPERATIONS[node.op].help));
  if(state.selection.length)host.append(el('p','Contexto visual: '+state.selection.join(' › ')));
  for(const key of RULE_OPERATIONS[node.op]?.inputs||[])host.append(button(portLabels[key]||'Editar '+key+' tipado',()=>{state.selection.push(key);render();}));
  try{
   if(actionScope){compileActionExpression(pkg.system,state.ast,resultType,actionScope);status.textContent=Object.values(state.errors).join('; ')||'Expressão tipada válida. O resultado depende das entradas e dos resultados da execução.';}
   else{
   const sample=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate));let id=state.ruleId||'draft-sample';while(!state.ruleId&&pkg.system.rules?.some(r=>r.id===id))id+='-new';
   const rule={id,label:'Ensaio',revision:1,kind:state.kind,resultType:state.resultType,expression:structuredClone(state.ast),...(state.contextDataId?{context:{dataId:state.contextDataId}}:{})},system={...pkg.system,rules:[...(pkg.system.rules||[]).filter(r=>r.id!==id),rule]},evaluation=createRuleContext(system,sample,{trace:true});
   const value=evaluation.evaluate(id);status.textContent=Object.values(state.errors).join('; ')||'Resultado no personagem inicial fictício: '+String(value);const trace=el('details');trace.append(el('summary','Resultados intermediários do cálculo'));for(const row of evaluation.trace)trace.append(el('p',row.label+': '+row.value));host.append(trace);
   }
  }catch(error){status.textContent=Object.values(state.errors).join('; ')||'Ensaio: '+error.message;}
  host.append(status);
  const details=el('details');details.append(el('summary','Operações e fontes tipadas'));for(const {part,path}of parts.slice(0,128))details.append(button((path.join(' › ')||'Cálculo inteiro')+': '+(RULE_OPERATIONS[part.op]?.label||part.op)+(part.op==='read'?' · '+(sources.find(r=>r.definition.id===part.dataId)?.definition.label||'fonte ausente'):part.op==='literal'?' · '+String(part.value):''),()=>{state.selection=[...path];render();}));host.append(details);
  if(state.dirty)host.append(button('Descartar edição do cálculo tipado',()=>{state.ast=structuredClone(expression||ruleNode());state.kind=kind;state.resultType=resultType;state.contextDataId=context?.dataId||'';state.rawValues={};state.errors={};state.selection=[];state.dirty=false;onEdit(state);render();}));
  if(onApply)host.append(button('Aplicar cálculo tipado',()=>{if(Object.keys(state.errors).length){status.textContent=Object.values(state.errors).join('; ');return;}onApply(structuredClone(state.ast));}));
 };render();return ()=>{if(Object.keys(state.errors).length)throw Error(Object.values(state.errors).join('; '));return structuredClone(state.ast);};
}
