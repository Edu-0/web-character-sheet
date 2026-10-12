import {el,button,choose,input} from './authoring-dom.js';
import {dataDefinitions} from '../engine/data-definitions.js';
import {compileProgression} from '../engine/progression-choices.js';
import {mountTypedRuleBuilder} from './typed-rule-builder.js';
import {setValueCommands,numberFromText} from './form-commands.js';
import {applyOperations} from './operations.js';
import {prepareDocument} from '../validation/documents.js';
import {structuralNodes,valueAt} from './form-structure.js';
const id=prefix=>prefix+'-'+crypto.randomUUID(),literal=value=>({id:id('node'),op:'literal',version:1,value});
const modes={creation:'Criação',paid:'Evolução paga',narrative:'Concessão narrativa'};

export function renderProgressionAuthoring(view,pkg){
 const host=el('details','','editor-progression-authoring');host.append(el('summary','Criação, evolução e concessões'));if(pkg.system?.schemaVersion!==3){host.append(el('p','Habilite sistema v3 explicitamente para configurar escolhas.'));return host;}
 const ui=view.session.ui;ui.progressionAuthoring??={};const state=ui.progressionAuthoring,pendingKey='/system/progressionChoices';host.open=state.open===true;let populated=false;
 const reset=()=>{state.config=structuredClone(pkg.system.progressionChoices||{version:1,revision:1,creationDataId:'',evolutionDataId:'',reopenCreation:false,revocation:'noRefund',options:[]});state.baseline=JSON.stringify(pkg.system.progressionChoices??null);state.raw={};state.builders={};state.dirty=false;state.error='';};if(!state.config)reset();
 const changed=()=>{state.dirty=true;state.error='';ui.formPending??={};ui.formPending[pendingKey]={builder:'progression',mode:'progression',raw:'Escolhas e concessões em edição'};view.onPending?.();};
 const draw=()=>{
  host.replaceChildren(el('summary','Criação, evolução e concessões'));host.open=true;populated=true;const config=state.config,readers=[];
  host.append(el('p','Declare orçamentos separados, requisitos, preços, escolhas e benefícios. A prévia confirma tudo junto. Edição direta não compra capacidades; registros preservam preço e origem.'));
  const message=el('p',state.error);message.setAttribute('role','status');message.setAttribute('aria-live','polite');const run=fn=>view.run(async()=>{try{await fn();}catch(error){state.error=error.message;message.textContent=error.message;throw error;}});
  const clearDrafts=ids=>{for(const key of [...Object.keys(state.builders),...Object.keys(state.raw)])if(ids.some(id=>key.includes(id))){delete state.builders[key];delete state.raw[key];}};
  const fields=dataDefinitions(pkg.system).filter(row=>!row.ancestors.some(parent=>parent.type==='collection')),numeric=fields.filter(row=>['number','integer'].includes(row.definition.type));
  const text=(at,target,key,label,numeric=false)=>{const control=input(label,state.raw[label]??String(target[key]??''));at.append(control.wrap);control.input.addEventListener('input',()=>{state.raw[label]=control.input.value;if(!numeric)target[key]=control.input.value;changed();});readers.push(()=>{target[key]=numeric?numberFromText(control.input.value):control.input.value;});};
  const selection=(at,target,key,label,options,redraw=false)=>{const control=choose(label,options,String(target[key]??''));at.append(control.wrap);control.input.addEventListener('change',()=>{target[key]=control.input.value;changed();if(redraw)draw();});return control;};
  for(const [key,label]of [['creationDataId','Orçamento da criação tipada'],['evolutionDataId','Orçamento da evolução tipada']])selection(host,config,key,label,[['','Escolha orçamento'],...numeric.map(row=>[row.definition.id,row.definition.label])]);
  const reopen=selection(host,config,'reopenCreation','Reabrir criação sem histórico de evolução',[['false','Bloquear'],['true','Permitir com snapshot preservado']]);reopen.input.addEventListener('change',()=>{config.reopenCreation=reopen.input.value==='true';});
  selection(host,config,'revocation','Ao revogar aquisição',[['noRefund','Sem devolver custo'],['originalCost','Devolver somente custo registrado']]);
  const expression=(at,label,owner,key,expected='number',definition)=>{
   const box=el('details');box.append(el('summary',label));const content=el('div');box.append(content);at.append(box);state.builders[label]??={};let mounted=false;
   box.addEventListener('toggle',()=>{if(!box.open||mounted)return;mounted=true;mountTypedRuleBuilder(content,{pkg,state:state.builders[label],expression:owner[key],resultType:expected,scopeLabel:label,actionScope:{inputs:[],locals:[],...(definition?{expectedDefinition:definition}:{})},onEdit:builder=>{owner[key]=structuredClone(builder.ast);changed();}});});
  };
  const grants=(at,rows,scope)=>{
   for(const grant of rows){const box=el('fieldset');box.append(el('legend','Concessão '+grant.id));at.append(box);text(box,grant,'label','Nome da concessão '+grant.id);
    selection(box,grant,'type','Operação da concessão '+grant.id,[['set','Definir valor'],['add','Somar contribuição'],['append','Inserir entrada própria']],true);
    const compatible=fields.filter(row=>grant.type==='add'?['number','integer'].includes(row.definition.type):grant.type==='append'?row.definition.type==='collection':!['record','collection'].includes(row.definition.type));
    selection(box,grant,'dataId','Dado da concessão '+grant.id,[['','Escolha dado'],...compatible.map(row=>[row.definition.id,row.definition.label+' · '+row.definition.type])],true);
    const action=selection(box,grant,'actionId','Ação vinculada à concessão '+grant.id,[['','Sem ação associada'],...(pkg.system.sheetActions||[]).map(action=>[action.id,action.label])]);action.input.addEventListener('change',()=>{if(!action.input.value)delete grant.actionId;});
    box.append(el('p','Para conceder uma ação, vincule este dado à permissão ou ao contador de usos da ação. A associação registra a origem; não cria custo ou permissão ocultos.'));
    const definition=fields.find(row=>row.definition.id===grant.dataId)?.definition;
    if(grant.type==='append'){delete grant.expression;grant.values??={};for(const field of definition?.fields||[]){grant.values[field.id]??=literal(0);expression(box,'Campo concedido '+field.label+' · '+grant.id,grant.values,field.id,field.type==='integer'?'number':field.type,field);}}
    else{delete grant.values;grant.expression??=literal(0);expression(box,'Valor concedido '+grant.id,grant,'expression',grant.type==='add'||definition?.type==='integer'?'number':definition?.type||'number',grant.type==='set'?definition:undefined);}
    box.append(button('Remover concessão '+grant.id,()=>{rows.splice(rows.indexOf(grant),1);clearDrafts([grant.id]);changed();draw();}));
   }
   at.append(button('Adicionar concessão em '+scope,()=>{rows.push({id:id('grant'),label:'',type:'set',dataId:'',expression:literal(0)});changed();draw();}));
  };
  for(const option of config.options){
   const box=el('details');box.open=state['open:'+option.id]===true;box.append(el('summary',option.label||'Nova opção '+option.id));box.addEventListener('toggle',()=>{state['open:'+option.id]=box.open;view.onPending?.();});host.append(box);text(box,option,'label','Nome da opção '+option.id);text(box,option,'maxAcquisitions','Aquisições máximas '+option.id,true);
   for(const [mode,label]of Object.entries(modes)){const wrap=el('label',label),check=el('input');check.type='checkbox';check.checked=option.modes.includes(mode);check.setAttribute('aria-label','Permitir '+label+' em '+option.id);wrap.prepend(check);box.append(wrap);check.addEventListener('change',()=>{option.modes=check.checked?[...option.modes,mode]:option.modes.filter(value=>value!==mode);changed();draw();});if(option.modes.includes(mode)&&mode!=='narrative'){option.cost[mode]??=literal(0);expression(box,'Custo '+label+' · '+option.id,option.cost,mode);}}
   const requirement=choose('Requisito da opção '+option.id,[['','Sem condição'],...(pkg.system.rules||[]).filter(rule=>rule.kind==='predicate'&&!rule.context).map(rule=>[rule.id,rule.label])],option.allowWhen?.ruleId||'');box.append(requirement.wrap);requirement.input.addEventListener('change',()=>{if(requirement.input.value)option.allowWhen={ruleId:requirement.input.value};else delete option.allowWhen;changed();});
   for(const source of config.options.filter(source=>source.id!==option.id)){const wrap=el('label','Exige '+(source.label||source.id)),check=el('input');check.type='checkbox';check.checked=option.requires.includes(source.id);check.setAttribute('aria-label','Exigir '+source.id+' em '+option.id);wrap.prepend(check);box.append(wrap);check.addEventListener('change',()=>{option.requires=check.checked?[...option.requires,source.id]:option.requires.filter(value=>value!==source.id);changed();});}
   grants(box,option.grants,option.id);
   for(const choice of option.choices){const group=el('fieldset');group.append(el('legend','Escolha '+choice.id));box.append(group);text(group,choice,'label','Nome da escolha '+choice.id);text(group,choice,'minimum','Mínimo de alternativas '+choice.id,true);text(group,choice,'maximum','Máximo de alternativas '+choice.id,true);
    for(const alternative of choice.options){const section=el('details');section.open=state['open:'+alternative.id]===true;section.addEventListener('toggle',()=>{state['open:'+alternative.id]=section.open;view.onPending?.();});section.append(el('summary',alternative.label||'Alternativa '+alternative.id));group.append(section);text(section,alternative,'label','Nome da alternativa '+alternative.id);grants(section,alternative.grants,alternative.id);section.append(button('Remover alternativa '+alternative.id,()=>{choice.options.splice(choice.options.indexOf(alternative),1);clearDrafts([alternative.id,...alternative.grants.map(grant=>grant.id)]);changed();draw();}));}
    group.append(button('Adicionar alternativa em '+choice.id,()=>{choice.options.push({id:id('alternative'),label:'',grants:[]});changed();draw();}),button('Remover escolha '+choice.id,()=>{option.choices.splice(option.choices.indexOf(choice),1);clearDrafts([choice.id,...choice.options.flatMap(alternative=>[alternative.id,...alternative.grants.map(grant=>grant.id)])]);changed();draw();}));
   }
   box.append(button('Adicionar escolha em '+option.id,()=>{option.choices.push({id:id('choice'),label:'',minimum:1,maximum:1,options:[]});changed();draw();}),button('Remover opção '+option.id,()=>{config.options.splice(config.options.indexOf(option),1);clearDrafts([option.id,...option.grants.map(grant=>grant.id),...option.choices.flatMap(choice=>[choice.id,...choice.options.flatMap(alternative=>[alternative.id,...alternative.grants.map(grant=>grant.id)])])]);changed();draw();}));
  }
  host.append(button('Adicionar opção de progressão',()=>{const option={id:id('progression'),label:'',modes:['creation'],requires:[],maxAcquisitions:1,cost:{creation:literal(0)},grants:[],choices:[]};config.options.push(option);state['open:'+option.id]=true;changed();draw();}),message);
  host.append(button('Descartar progressão pendente',()=>{delete ui.formPending?.[pendingKey];reset();view.onPending?.(true);draw();}),button('Revisar progressão tipada',()=>run(async()=>{
   readers.forEach(read=>read());for(const builder of Object.values(state.builders))if(Object.keys(builder.errors||{}).length)throw Error(Object.values(builder.errors).join('; '));if(JSON.stringify(pkg.system.progressionChoices??null)!==state.baseline)throw Error('Progressão mudou durante a edição.');
   const next=structuredClone(config);next.revision=(pkg.system.progressionChoices?.revision||0)+1;compileProgression({...pkg.system,progressionChoices:next});const commands=setValueCommands(pkg,['system','progressionChoices'],next);if(pkg.system.characterTemplate.schemaVersion!==3)commands.push({type:'setProperty',path:['system','characterTemplate','schemaVersion'],value:3});
   for(const [li]of pkg.layouts.entries()){const nodes=structuralNodes(pkg).filter(row=>row.kind==='component'&&row.path[1]===li);if(nodes.some(row=>row.value.type==='progressionChoices'))continue;const container=structuralNodes(pkg).find(row=>row.kind==='container'&&row.path[1]===li);if(!container)throw Error('Layout sem destino para as escolhas.');const path=[...container.path,'components'];commands.push({type:'insertNode',path,index:valueAt(pkg,path).length,value:{type:'progressionChoices',label:'Criação e evolução'}});}
   const result=prepareDocument(JSON.parse(applyOperations(view.session.text,commands)),{kind:'package'});if(result.status!=='ready')throw Error(result.diagnostics.slice(0,3).map(diagnostic=>diagnostic.message).join('; '));const revision=view.session.revision;if(!await view.confirm('Aplicar escolhas e controles nos layouts? Novos personagens usarão v3; dados atuais e preços já registrados serão preservados.'))return;if(view.session.revision!==revision)throw Error('Revisão mudou.');const pending=ui.formPending[pendingKey];delete ui.formPending[pendingKey];try{view.commit(commands,'Configurar escolhas e concessões',view.selection);}catch(error){ui.formPending[pendingKey]=pending;throw error;}delete ui.progressionAuthoring;view.refresh(true);
  })));
 };
 host.addEventListener('toggle',()=>{state.open=host.open;if(host.open&&!populated)draw();view.onPending?.();});if(host.open)draw();return host;
}
