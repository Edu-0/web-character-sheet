import {DATA_TYPES, BOUND_COMPONENT_TYPES} from '../engine/data-definitions.js';
import {version3Plan} from './package-commands.js';
import {createTypedDataPlan, bindDataPlan, createTypedRulePlan} from './typed-data-commands.js';
import {mountTypedRuleBuilder} from './typed-rule-builder.js';
import {structuralNodes} from './form-structure.js';
import {prepareDocument} from '../validation/documents.js';
import {applyOperations} from './operations.js';
import {numberFromText} from './form-commands.js';
import {pointerFor} from './source-map.js';
import {el,button,choose,input} from './authoring-dom.js';

export function renderTypedDataPanel(view,pkg) {
  const panel=el('details','','editor-typed-data');panel.append(el('summary','Dados tipados e vínculos'));
  if(pkg.schemaVersion!==3 || pkg.system.schemaVersion!==3){panel.append(el('p','Este pacote mantém seu contrato v1/v2. Criar pacote inicia v3; não há conversão automática ao abrir.'),button('Habilitar dados tipados (v3)',()=>view.run(async()=>{
    if(Object.keys(view.session.ui.formPending||{}).length)throw new Error('Resolva as pendências antes de mudar a versão.');
    const plan=version3Plan(pkg),revision=view.session.revision,result=prepareDocument(JSON.parse(applyOperations(view.session.text,plan.commands)),{kind:'package'});
    if(result.status!=='ready')throw new Error('Corrija o pacote antes de habilitar v3: '+result.diagnostics.map(d=>d.message).slice(0,3).join('; '));
    if(!await view.confirm('Habilitar contrato v3? Fórmulas, campos e valores antigos são conservados; nenhuma regra antiga é convertida para operações novas. Leitores que aceitam apenas v1/v2 não poderão abrir o pacote. Personagens não são migrados.'))return;
    if(revision!==view.session.revision)throw new Error('A revisão mudou.');view.commit(plan.commands,'Habilitar contrato v3 explicitamente',view.selection);
  })));return panel;}
  const ui=view.session.ui;ui.typedInputs??={};const state=ui.typedInputs;
  panel.open=state.open===true;let populated=false;
  const remember=(key,c)=>c.addEventListener('input',()=>{state[key]=c.value;view.onPending?.();});
  const checkedCommit=async(commands,label,selection)=>{
    const result=prepareDocument(JSON.parse(applyOperations(view.session.text,commands)),{kind:'package'});
    if(result.status!=='ready')throw new Error(result.diagnostics.map(d=>d.message).slice(0,3).join('; '));
    const revision=view.session.revision;if(!await view.confirm(label+'? Cancelar conserva o pacote.'))return;
    if(revision!==view.session.revision)throw new Error('A revisão mudou.');
    view.commit(commands,label,selection||view.selection);
  };
  const populate=()=>{
    if(populated || !panel.open)return;populated=true;
    panel.append(el('p','Dados existem sem componentes. Dois componentes podem usar a mesma identidade e o mesmo valor. Valor inicial só é aplicado na criação; a amostra de Experimentar não entra no pacote.','editor-note'));
    const name=input('Nome do dado tipado',state.name||''),type=choose('Tipo do dado tipado',DATA_TYPES.slice(0,4).map(t=>[t,({string:'Texto',number:'Número finito',integer:'Inteiro',boolean:'Sim/Não'})[t]]),state.type||'number'),required=choose('Presença exigida do dado',[['false','Opcional'],['true','Obrigatório']],state.required||'false'),nullable=choose('O dado admite null',[['false','Não'],['true','Sim']],state.nullable||'false'),initialMode=choose('Inicial do dado tipado',[['absent','Sem valor inicial'],['value','Valor inicial'],['null','null explícito']],state.initialMode||'absent');
    for(const [key,c]of [['name',name],['type',type],['required',required],['nullable',nullable],['initialMode',initialMode]]){remember(key,c.input);panel.append(c.wrap);}
    const initialBox=el('div');panel.append(initialBox);let readInitial=()=>undefined;
    const draw=()=>{initialBox.replaceChildren();if(initialMode.input.value!=='value'){readInitial=()=>initialMode.input.value==='null'?null:undefined;return;}const value=type.input.value==='boolean'?choose('Inicial preenchido do dado',[['false','Não'],['true','Sim']],state.initial||'false'):input('Inicial preenchido do dado',state.initial||'');remember('initial',value.input);initialBox.append(value.wrap);readInitial=()=>['number','integer'].includes(type.input.value)?numberFromText(value.input.value):type.input.value==='boolean'?value.input.value==='true':value.input.value;};type.input.addEventListener('change',draw);initialMode.input.addEventListener('change',draw);draw();
    panel.append(button('Revisar dado tipado',()=>view.run(async()=>{const plan=createTypedDataPlan(pkg,{name:name.input.value,type:type.input.value,required:required.input.value==='true',nullable:nullable.input.value==='true',hasInitial:initialMode.input.value!=='absent',initial:readInitial()});await checkedCommit(plan.commands,'Criar dado tipado');})));
    const nodes=structuralNodes(pkg).filter(n=>n.kind==='component');
    for(const [i,d]of (pkg.system.dataDefinitions||[]).entries()) {
      const row=el('details');row.append(el('summary',d.label+' · '+d.type+' · '+(d.required?'obrigatório':'opcional')));
      const usages=nodes.filter(n=>n.value.dataId===d.id);row.append(el('p','Identidade: '+d.id+'. Binding: '+d.binding+'. '+usages.length+' componentes usam este dado.'));
      for(const n of usages)row.append(button('Mostrar uso: '+n.title,()=>{view.selectPointer(n.pointer);view.refresh(true);view.onPending?.();}));
      const title=input('Novo rótulo de '+d.label,state['label:'+d.id]??d.label);remember('label:'+d.id,title.input);row.append(title.wrap,button('Aplicar rótulo de '+d.label,()=>view.run(()=>checkedCommit([{type:'setProperty',path:['system','dataDefinitions',i,'label'],value:title.input.value}],'Renomear rótulo sem mudar identidade'))));
      panel.append(row);
    }
    const selected=nodes.find(n=>pointerFor(n.path)===pointerFor(view.selection||[]));
    if(selected && BOUND_COMPONENT_TYPES[selected.value.type]){
      const options=(pkg.system.dataDefinitions||[]).filter(d=>BOUND_COMPONENT_TYPES[selected.value.type].includes(d.type));
      const binding=choose('Vincular valor de '+selected.title,[['','Escolha um dado'],...options.map(d=>[d.id,d.label+' · '+d.type])],selected.value.dataId||'');
      panel.append(binding.wrap,button('Revisar vínculo do componente',()=>view.run(()=>checkedCommit(bindDataPlan(pkg,selected.path,binding.input.value).commands,'Vincular componente ao dado existente',selected.path))));
    }
    panel.append(renderTypedRules(view,pkg,checkedCommit));
  };
  panel.addEventListener('toggle',()=>{state.open=panel.open;populate();view.onPending?.();});populate();return panel;
}
function renderTypedRules(view,pkg,checkedCommit){
  const host=el('section','','editor-typed-rules');host.append(el('h3','Cálculos tipados'));const ui=view.session.ui;ui.typedRules??={};const state=ui.typedRules;
  const select=choose('Cálculo tipado para editar',[['','Criar cálculo independente'],...(pkg.system.rules||[]).map(r=>[r.id,r.label])],state.id||'');host.append(select.wrap);
  const body=el('div');host.append(body);
  const draw=()=>{
    body.replaceChildren();state.id=select.input.value;const index=(pkg.system.rules||[]).findIndex(r=>r.id===state.id),rule=pkg.system.rules?.[index];state.drafts??={};const draft=state.drafts[state.id||'new']??={};if(rule&&!draft.dirty)draft.ast=structuredClone(rule.expression);
    const name=input('Nome do cálculo tipado',draft.name??rule?.label??'');body.append(name.wrap);name.input.addEventListener('input',()=>{draft.name=name.input.value;view.onPending?.();});
    const builder=el('div');body.append(builder);const pointer=rule?pointerFor(['system','rules',index,'expression']):null;
    const pending=()=>{if(pointer){ui.formPending??={};if(draft.dirty)ui.formPending[pointer]={raw:JSON.stringify(draft.ast),mode:'value',valueType:'object'};else delete ui.formPending[pointer];}view.onPending?.();};
    mountTypedRuleBuilder(builder,{pkg,state:draft,expression:rule?.expression,onEdit:pending,onApply:expression=>view.run(async()=>{
      const commands=rule?[{type:'setProperty',path:['system','rules',index,'expression'],value:expression},{type:'setProperty',path:['system','rules',index,'label'],value:name.input.value},{type:'setProperty',path:['system','rules',index,'revision'],value:rule.revision+1}]:createTypedRulePlan(pkg,{name:name.input.value,expression}).commands;
      // Keep existing pending barrier until confirmation; remove only for this commit.
      const previous=pointer?ui.formPending?.[pointer]:null;
      const revision=view.session.revision,result=prepareDocument(JSON.parse(applyOperations(view.session.text,commands)),{kind:'package'});
      if(result.status!=='ready')throw new Error(result.diagnostics.map(d=>d.message).slice(0,3).join('; '));
      if(!await view.confirm('Aplicar cálculo tipado? Todos os componentes que usam esta regra serão atualizados.'))return;
      if(revision!==view.session.revision)throw new Error('A revisão mudou.');
      if(pointer)delete ui.formPending?.[pointer];draft.dirty=false;
      try{view.commit(commands,'Aplicar cálculo tipado',view.selection);}catch(error){if(previous)ui.formPending[pointer]=previous;draft.dirty=true;throw error;}
    })});
  };select.input.addEventListener('change',()=>{draw();view.onPending?.();});draw();return host;
}
