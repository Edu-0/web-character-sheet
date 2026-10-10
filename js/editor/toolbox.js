import {TOOLBOX_GROUPS,tileKind} from './canvas-insertion.js';
import {mountFormulaContextChoice} from './formula-context-choice.js';
import {mountLocalImage} from './local-image-input.js';
import {mountCheckRecipe} from './check-recipe.js';
import {mountActionRecipe} from './operation-recipe.js';
import {mountEntryRollRecipe} from './entry-roll-recipe.js';
import {mountEffectRecipe} from './effect-recipe.js';
import {mountAssistedRecipe,ASSISTED_RECIPES} from './assisted-recipe.js';
import {mountProgressionRecipe} from './progression-recipe.js';
import {mountPoolRecipe} from './pool-recipe.js';
import {mountTechniqueRecipe} from './technique-recipe.js';
import {mountDndRecipe} from './dnd-recipe.js';
import {mountFormulaBuilder} from './formula-builder.js';
import {printFormula} from './formula-codec.js';
import {COMPONENT_CONTRACTS} from '../validation/contracts.js';
import {structuralNodes,valueAt} from './form-structure.js';
import {insertionPlan,namedDestinations as destinations} from './composition-commands.js';
import {compatibleData,displayData} from './data-index.js';
import {pointerFor} from './source-map.js';
import {numberFromText} from './form-commands.js';
import {applyOperations} from './operations.js';
import {prepareDocument} from '../validation/documents.js';
import {el,button,choose,input} from './authoring-dom.js';
export function renderToolbox(view,pkg,selected){
 const host=el('section','','editor-toolbox');if(!pkg.system||typeof pkg.system!=='object'||Array.isArray(pkg.system)){host.append(el('p','Repare primeiro o ramo Sistema no inspector. Seu valor incompatível continua preservado.'));return host;}host.append(el('h2','Adicionar à ficha'),el('p','Arraste um card para a prévia ou toque para configurar. Campos prontos entram ao soltar. Regras usam receitas para escolher suas fontes e dependências.','editor-note'));
 const ui=view.session.ui;ui.authoringInputs??={};const state=ui.authoringInputs;
 const remember=(key,control)=>control.addEventListener('input',()=>{state[key]=control.type==='checkbox'?control.checked:control.value;view.onPending?.();});
 const search=input('Buscar componente por finalidade',state.search||'');remember('search',search.input);host.append(search.wrap);
 const types=Object.entries(COMPONENT_CONTRACTS).map(([type,c])=>[type,c.summary]);
 const type=choose('O que adicionar',types,state.type||'text'),cards=el('div','','editor-toolbox-cards');cards.setAttribute('aria-label','Cards para compor a ficha');for(const [title,items]of TOOLBOX_GROUPS){const group=el('details','','editor-toolbox-category');group.open=['Textos','Elementos','Caixas'].includes(title);group.append(el('summary',title));const grid=el('div');for(const [key,name]of items){const tile=button(name,()=>{if(tileKind(key)!=='component'){view.onChooseStructure?.(key);return;}type.input.value=key;type.input.dispatchEvent(new Event('change'));});tile.dataset.toolboxType=key;tile.title='Arraste '+name+' para a ficha ou toque para configurar.';tile.classList.add('editor-toolbox-card');grid.append(tile);}group.append(grid);cards.append(group);}const configurePanel=el('details','','editor-toolbox-configure');configurePanel.open=state.configuring===true;configurePanel.append(el('summary','Configurar inclusão'));configurePanel.addEventListener('toggle',()=>{state.configuring=configurePanel.open;view.onPending?.();});const form=el('div','','editor-toolbox-form');configurePanel.append(form);host.append(cards,type.wrap,configurePanel);
 const populate=()=>{
  state.type=type.input.value;form.replaceChildren();const kind=type.input.value;
  const name=input('Nome mostrado na ficha',state.name||'');remember('name',name.input);form.append(name.wrap);
  const ds=destinations(pkg,'component');const destination=choose('Onde colocar',ds.map(d=>[pointerFor(d.path),d.title]),selected?.kind==='container'?pointerFor([...selected.path,'components']):selected?.kind==='component'?pointerFor(selected.path.slice(0,-1)):state.destination||pointerFor(ds[0]?.path||[]));remember('destination',destination.input);form.append(destination.wrap);
  const prototypes=structuralNodes(pkg).filter(n=>n.kind==='component'&&n.value?.type===kind);
  const method=choose('Como configurar',[['new','Criar configuração'],...prototypes.map(n=>[n.pointer,'Reutilizar: '+n.title])],state.method||'new');remember('method',method.input);form.append(method.wrap);
  const body=el('div');form.append(body);let read=()=>({}),recipeRead=null;
  const configure=()=>{body.replaceChildren();read=()=>({});recipeRead=null;if(method.input.value!=='new'){body.append(el('p','Esta cópia compartilha os mesmos dados e regras. Editar a regra afeta seus consumidores.'));return;}
   state.ruleDrafts??={};const draft=state.ruleDrafts[kind]??={};const notify=()=>view.onPending?.();
   if(kind==='list'){const purpose=choose('Uso desta lista',[['plain','Preencher e consultar registros'],['roll','Entradas com teste, efeito ou consumo']],state.listPurpose||'plain');body.append(purpose.wrap);purpose.input.addEventListener('change',()=>{state.listPurpose=purpose.input.value;configure();notify();});if(purpose.input.value==='roll'){const recipe=el('div');body.append(recipe);recipeRead=mountEntryRollRecipe(recipe,{pkg,state:draft,notify});return;}}
   if(kind==='checkRoll'){recipeRead=mountCheckRecipe(body,{pkg,state:draft,notify});return;}
   if(kind==='actionGroup'||kind==='recoveryGroup'){recipeRead=mountActionRecipe(body,{pkg,state:draft,recovery:kind==='recoveryGroup',notify});return;}
   if(kind==='effectList'){recipeRead=mountEffectRecipe(body,{pkg,state:draft,notify});return;}
   if(ASSISTED_RECIPES.includes(kind)){recipeRead=mountAssistedRecipe(body,{pkg,type:kind,state:draft,notify});return;}
   if(['pointBudget','repertoire'].includes(kind)){recipeRead=mountProgressionRecipe(body,{pkg,type:kind,state:draft,notify});return;}
   if(kind==='poolBuilder'){recipeRead=mountPoolRecipe(body,{pkg,state:draft,notify});return;}
   if(kind==='techniqueUse'){recipeRead=mountTechniqueRecipe(body,{pkg,state:draft,notify});return;}
   if(['dndAbility','dndSkill','dndDerived'].includes(kind)){recipeRead=mountDndRecipe(body,{pkg,type:kind,state:draft,notify});return;}
   if(COMPONENT_CONTRACTS[kind].properties.field?.required){
    const data=choose('Dado do personagem',[['','Criar dado com este nome'],...compatibleData(pkg,kind).map(d=>[d.field,displayData(d)])],state.field||'');remember('field',data.input);body.append(data.wrap);
    const initialBox=el('div');body.append(initialBox);let initialRead=()=>({});const drawInitial=()=>{initialBox.replaceChildren();initialRead=()=>({});if(data.input.value)return;
     if(kind==='resource'){const current=input('Valor atual inicial',state.current??'0'),max=input('Valor máximo inicial',state.max??'10');remember('current',current.input);remember('max',max.input);initialBox.append(current.wrap,max.wrap);initialRead=()=>({hasInitial:true,initial:{current:numberFromText(current.input.value),max:numberFromText(max.input.value)}});}
     else if(!['list','table','stateList','slotTracker','tagList'].includes(kind)){
      const initialState=kind==='image'?(state.imageDraft??={}):state;const saveInitial=(key,control)=>control.addEventListener('input',()=>{initialState[key]=control.value;view.onPending?.();});
      const presence=choose('Valor inicial',[['absent','Sem valor inicial'],['value','Definir valor inicial']],initialState.initialMode||'absent');saveInitial('initialMode',presence.input);
      const value=kind==='boolean'?choose('Valor do novo dado',[['false','Não'],['true','Sim']],initialState.initial||'false'):input('Valor do novo dado',initialState.initial||'');saveInitial('initial',value.input);initialBox.append(presence.wrap,value.wrap);if(kind==='image')mountLocalImage(initialBox,{onPending:filename=>{initialState.imageStatus='Preparando '+filename;view.onPending?.();},onValue:text=>{initialState.imageStatus='';initialState.initial=text;initialState.initialMode='value';value.input.value=text;presence.input.value='value';view.onPending?.();},onError:message=>{initialState.imageStatus=message;view.onPending?.();}});initialRead=()=>{if(kind==='image'&&initialState.imageStatus)throw new Error(initialState.imageStatus);return {hasInitial:presence.input.value==='value',initial:['number','counter','die'].includes(kind)&&presence.input.value==='value'?numberFromText(value.input.value):kind==='boolean'?value.input.value==='true':value.input.value};};
     }
    };data.input.addEventListener('change',drawInitial);drawInitial();read=()=>({existingField:data.input.value,...initialRead()});
   }
   if(kind==='select'){
    const options=el('div'),newOption=input('Texto da opção',state.option||'');remember('option',newOption.input);state.options??=[];
    const draw=()=>{options.replaceChildren();state.options.forEach((v,i)=>options.append(el('span',v),button('Remover opção '+v,()=>{state.options.splice(i,1);draw();view.onPending?.();})));};draw();body.append(options,newOption.wrap,button('Acrescentar opção',()=>{if(newOption.input.value==='')return;state.options.push(newOption.input.value);newOption.input.value='';state.option='';draw();view.onPending?.();}));const before=read;read=()=>({...before(),options:state.options});
   }
   if(kind==='computed'){const formulas=choose('Cálculo compartilhado',[['','Construir cálculo novo'],...Object.keys(pkg.system.formulas||{}).map(key=>[key,key])],state.formula);remember('formula',formulas.input);body.append(formulas.wrap,el('p','Use o cálculo existente. O construtor de cálculos permite criar e trocar suas operações e fontes.','editor-note'));const builder=el('div','','editor-domain-builder'),contextBox=el('div');body.append(contextBox,builder);let contextRead=()=>({});const showBuilder=()=>{contextBox.replaceChildren();contextRead=()=>({});builder.hidden=!!formulas.input.value;if(formulas.input.value){state.formulaContexts??={};contextRead=mountFormulaContextChoice(contextBox,{pkg,name:formulas.input.value,state:state.formulaContexts[formulas.input.value]??={},onEdit:()=>view.onPending?.()});return;}state.newFormulaDraft??={};mountFormulaBuilder(builder,{expression:'0',pkg,state:state.newFormulaDraft,onEdit:(text,draft)=>{state.newFormulaTouched=true;view.onPending?.();},onApply:text=>{state.newFormulaTouched=true;view.onPending?.();}});};formulas.input.addEventListener('change',showBuilder);showBuilder();read=()=>{if(formulas.input.value)return {existingFormula:formulas.input.value,...contextRead()};if(!state.newFormulaTouched||state.newFormulaDraft.invalid)throw new Error('Monte e corrija o cálculo antes de incluir.');return {formula:printFormula(state.newFormulaDraft.ast)};};}
   if(['poolBuilder','pointBudget','repertoire','actionGroup','recoveryGroup','techniqueUse','checkRoll','effectList','traitAllocation','inventorySummary','stateList','skillCatalog','slotTracker','dndAbility','dndSkill','dndDerived'].includes(kind))body.append(el('p','Este módulo precisa de sua receita completa. Você pode reutilizar um exemplo deste pacote e configurar suas propriedades e regras.','editor-note'));
  };method.input.addEventListener('change',configure);configure();
  view.inclusionPlan=target=>{const prototype=prototypes.find(n=>n.pointer===method.input.value)?.value;return recipeRead?recipeRead({name:name.input.value,destination:target}):insertionPlan(pkg,{type:kind,name:name.input.value,destination:target,prototype,...read()});};
  const feedback=el('p');feedback.setAttribute('role','status');form.append(button('Revisar inclusão',()=>view.run(async()=>{
   const revision=view.session.revision,prototype=prototypes.find(n=>n.pointer===method.input.value)?.value;
   const target=ds.find(d=>pointerFor(d.path)===destination.input.value)?.path;const plan=view.inclusionPlan(target),slot=state.canvasPosition;if(slot&&pointerFor(slot.path)===pointerFor(target)){const insertion=plan.commands.findLast(c=>c.type==='insertNode'&&pointerFor(c.path)===pointerFor(target));if(insertion){insertion.index=Math.min(slot.index,valueAt(pkg,target).length);plan.selection=[...target,insertion.index];}}
   const result=prepareDocument(JSON.parse(applyOperations(view.session.text,plan.commands)),{kind:'package'});if(result.status!=='ready')throw new Error('A inclusão ainda precisa de configuração: '+result.diagnostics.map(d=>d.message).slice(0,3).join('; '));
   if(!await view.confirm('Incluir '+(name.input.value||kind)+'?\n'+plan.dependencies.join('\n')+'\nCancelar conserva o pacote.'))return;
   if(revision!==view.session.revision)throw new Error('A revisão mudou. Revise a inclusão novamente.');
   view.commit(plan.commands,'Incluir componente e dependências',plan.selection);delete state.canvasPosition;feedback.textContent='Componente incluído.';
  })),feedback);
 };type.input.addEventListener('change',()=>{configurePanel.open=true;state.configuring=true;state.method='new';state.field='';state.initialMode='absent';populate();view.onPending?.();});populate();search.input.addEventListener('input',()=>{const query=search.input.value.toLocaleLowerCase('pt-BR');for(const option of type.input.options)option.hidden=!!query&&!option.textContent.toLocaleLowerCase('pt-BR').includes(query)&&!option.value.includes(query);for(const tile of cards.querySelectorAll('[data-toolbox-type]'))tile.hidden=!!query&&!tile.textContent.toLocaleLowerCase('pt-BR').includes(query)&&!COMPONENT_CONTRACTS[tile.dataset.toolboxType]?.summary.toLocaleLowerCase('pt-BR').includes(query);for(const group of cards.children){group.hidden=![...group.querySelectorAll('[data-toolbox-type]')].some(tile=>!tile.hidden);if(query&&!group.hidden)group.open=true;}});
 return host;
}
