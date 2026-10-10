import {RULE_OPERATIONS, evaluateRule} from '../engine/rule-registry.js';
import {initializeData} from '../engine/data-definitions.js';
import {valueAt} from './form-structure.js';
import {ruleNode,stepRecipe} from './typed-data-commands.js';
import {numberFromText} from './form-commands.js';
import {el,button,choose,input} from './authoring-dom.js';

export function mountTypedRuleBuilder(host,{pkg,state,expression,onEdit=()=>{},onApply}) {
  state.ast??=structuredClone(expression||ruleNode());state.selection??=[];state.rawValues??={};state.errors??={};
  const sources=(pkg.system.dataDefinitions||[]).filter(d=>['number','integer'].includes(d.type));
  const changed=()=>{state.dirty=true;onEdit(state);};
  const render=()=>{
    host.replaceChildren(el('h4','Construir cálculo tipado'),el('p','Ausente não vale zero. “Usar se ausente” avalia a alternativa somente quando falta o dado; null continua sendo erro numérico.','editor-note'));
    const recipe=el('details');recipe.append(el('summary','Receita: a cada N, um ponto'));state.recipe??={};
    const recipeSource=choose('Fonte da receita por intervalo',[['','Escolha um dado'],...sources.map(d=>[d.id,d.label])],state.recipe.source||''),step=input('Intervalo da receita',state.recipe.step??'5'),absence=choose('Fonte ausente na receita',[['error','Mostrar diagnóstico'],['zero','Usar zero explicitamente']],state.recipe.absence||'error');
    for(const [key,c]of [['source',recipeSource],['step',step],['absence',absence]])c.input.addEventListener('input',()=>{state.recipe[key]=c.input.value;onEdit(state);});
    const recipeStatus=el('p');recipeStatus.setAttribute('role','status');recipe.append(recipeSource.wrap,step.wrap,absence.wrap,el('p','Gera Arredondar para baixo → Dividir → fonte e intervalo. Todas as operações continuam editáveis.'),button('Usar receita por intervalo',()=>{
      try{if(Object.keys(state.errors).length)throw new Error('Resolva ou descarte o texto inválido antes de usar a receita.');state.ast=stepRecipe({dataId:recipeSource.input.value,step:numberFromText(step.input.value),...(absence.input.value==='zero'?{absentFallback:0}:{})});state.selection=[];changed();render();}catch(error){recipeStatus.textContent=error.message;}
    }),recipeStatus);host.append(recipe);
    if(!valueAt(state.ast,state.selection))state.selection=[];
    const node=valueAt(state.ast,state.selection),nav=el('nav');nav.append(button('Cálculo tipado inteiro',()=>{state.selection=[];render();}));
    if(state.selection.length)nav.append(button('Parte tipada anterior',()=>{state.selection.pop();render();}));host.append(nav);
    const operation=choose('Operação tipada desta parte',Object.entries(RULE_OPERATIONS).map(([key,v])=>[key,v.label]),node.op);host.append(operation.wrap);
    operation.input.addEventListener('change',()=>{
      if(Object.keys(state.errors).length){status.textContent='Resolva ou descarte o número inválido antes de trocar operações.';return;}
      const next=ruleNode(operation.input.value,node);
      if(!state.selection.length)state.ast=next;else valueAt(state.ast,state.selection.slice(0,-1))[state.selection.at(-1)]=next;
      changed();render();
    });
    if(node.op==='literal') {
      const key=JSON.stringify(state.selection),value=input('Número da operação tipada',state.rawValues[key]??String(node.value));host.append(value.wrap);
      value.input.addEventListener('input',()=>{state.rawValues[key]=value.input.value;try{node.value=numberFromText(value.input.value);delete state.errors[key];delete state.rawValues[key];}catch(error){state.errors[key]=error.message;}changed();status.textContent=Object.values(state.errors).join('; ')||'Alteração pendente; aplique o cálculo.';});
    }
    if(node.op==='read') {
      const source=choose('Dado fonte da operação tipada',[['','Escolha um dado'],...sources.map(d=>[d.id,d.label+' · '+d.type])],node.dataId);host.append(source.wrap);
      source.input.addEventListener('change',()=>{node.dataId=source.input.value;changed();render();});
    }
    const inputs=RULE_OPERATIONS[node.op]?.inputs||[];
    for(const key of inputs)host.append(button(({left:'Editar primeiro operando tipado',right:'Editar segundo operando tipado',value:'Editar valor tipado',fallback:'Editar alternativa se ausente'})[key],()=>{state.selection.push(key);render();}));
    const status=el('p');status.setAttribute('role','status');
    try{const sample=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate)),system={...pkg.system,rules:[{id:'sample',label:'Ensaio',revision:1,kind:'calculation',resultType:'number',expression:state.ast}]};status.textContent=Object.values(state.errors).join('; ')||'Resultado no personagem inicial fictício: '+evaluateRule(system,sample,'sample');}catch(error){status.textContent=Object.values(state.errors).join('; ')||'Ensaio: '+error.message;}
    host.append(status);
    let described=0;const details=el('details'),describe=(node,depth=0)=>{if(++described>128 || depth>16)return 'Limite de leitura';if(!node || typeof node!=='object')return 'Parte inválida';if(node.op==='read')return 'Ler '+(sources.find(d=>d.id===node.dataId)?.label||'fonte ausente');if(node.op==='literal')return String(node.value);return (RULE_OPERATIONS[node.op]?.label||node.op)+' ('+(RULE_OPERATIONS[node.op]?.inputs||[]).map(key=>describe(node[key],depth+1)).join(', ')+')';};
    details.append(el('summary','Operações e fontes tipadas'),el('p',describe(state.ast)));host.append(details);
    if(state.dirty)host.append(button('Descartar edição do cálculo tipado',()=>{state.ast=structuredClone(expression||ruleNode());state.rawValues={};state.errors={};state.selection=[];state.dirty=false;onEdit(state);render();}));
    if(onApply)host.append(button('Aplicar cálculo tipado',()=>{if(Object.keys(state.errors).length){status.textContent=Object.values(state.errors).join('; ');return;}onApply(structuredClone(state.ast));}));
  };render();return ()=>{if(Object.keys(state.errors).length)throw new Error(Object.values(state.errors).join('; '));return structuredClone(state.ast);};
}
