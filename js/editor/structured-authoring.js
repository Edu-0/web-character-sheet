import {DATA_TYPES,dataDefinitions} from '../engine/data-definitions.js';
import {createTypedDataPlan,addTypedFieldPlan,createCatalogPlan,definitionPaths} from './typed-data-commands.js';
import {createComponentDefinitionPlan,detachComponentPlan,copyComponentDefinitionPlan} from './component-definition-commands.js';
import {initialRecord} from '../engine/data-types.js';
import {mountRecordInputs} from '../engine/typed-record-inputs.js';
import {valueAt} from './form-structure.js';
import {prepareDocument} from '../validation/documents.js';
import {applyOperations} from './operations.js';
import {numberFromText} from './form-commands.js';
import {el,button,choose,input} from './authoring-dom.js';
const typeLabels={string:'Texto',number:'Número',integer:'Inteiro',boolean:'Sim/Não',enum:'Escolha com identidades',trait:'Traço de dados',record:'Registro',collection:'Coleção de registros',reference:'Referência'};

export function renderStructuredAuthoring(view,pkg){
  const host=el('details','','editor-structured-authoring');host.append(el('summary','Registros, coleções e compostos'));
  if(pkg.system?.schemaVersion!==3){host.append(el('p','Estas capacidades exigem habilitação explícita de v3.'));return host;}
  const ui=view.session.ui;ui.structuredInputs??={};const state=ui.structuredInputs;host.open=state.open===true;let populated=false;
  const remember=(key,c)=>c.addEventListener('input',()=>{state[key]=c.value;view.onPending?.();});
  const checkedCommit=async(plan,label)=>{
    const result=prepareDocument(JSON.parse(applyOperations(view.session.text,plan.commands)),{kind:'package'});
    if(result.status!=='ready')throw new Error(result.diagnostics.slice(0,3).map(d=>d.message).join('; '));
    const revision=view.session.revision;if(!await view.confirm(label+'? Nenhum personagem instalado será preenchido ou migrado.'))return;
    if(revision!==view.session.revision)throw new Error('A revisão mudou');view.commit(plan.commands,label,plan.selection||view.selection);
  };
  const populate=()=>{
    if(populated||!host.open)return;populated=true;
    host.append(el('p','Registro e coleção possuem campos com identidades próprias. Referência aponta ao original; copiar apresentação conserva os dados vinculados.'));
    const parents=definitionPaths(pkg).filter(r=>['record','collection'].includes(r.definition.type));
    const parent=choose('Onde definir o novo dado',[['','Dado independente do personagem'],...parents.map(r=>[r.definition.id,r.definition.label+' · '+typeLabels[r.definition.type]]),...(pkg.system.catalogs||[]).map(c=>[c.id,c.label+' · catálogo do sistema'])],state.parent||'');
    const name=input('Nome do novo dado estruturado',state.name||''),type=choose('Tipo do novo dado estruturado',DATA_TYPES.map(t=>[t,typeLabels[t]]),state.type||'collection');
    const required=choose('Novo dado é obrigatório',[['false','Opcional'],['true','Obrigatório']],state.required||'false'),nullable=choose('Novo dado aceita null',[['false','Não'],['true','Sim']],state.nullable||'false');
    for(const [key,c]of [['parent',parent],['name',name],['type',type],['required',required],['nullable',nullable]]){host.append(c.wrap);remember(key,c.input);}
    const settings=el('div');host.append(settings);let read=()=>({});
    const draw=()=>{
      settings.replaceChildren();const kind=type.input.value;state.options??=[];state.scale??=[4,6,8,10,12];
      const mode=choose('Inicial do novo dado estruturado',[['absent','Sem inicial'],['value','Inicial explícito'],['null','null explícito']],state.initialMode||(['record','collection'].includes(kind)?'value':'absent'));remember('initialMode',mode.input);settings.append(mode.wrap);
      let options=()=>({}),value=()=>undefined;
      const initial=el('div');settings.append(initial);
      const drawInitial=()=>{
        initial.replaceChildren();if(mode.input.value!=='value'){value=()=>mode.input.value==='null'?null:undefined;return;}
        if(['record','collection'].includes(kind)){initial.append(el('p',kind==='record'?'Inicial: registro vazio, sem campos inventados.':'Inicial: coleção vazia, sem entradas inventadas.'));value=()=>kind==='record'?{}:[];return;}
        const choices=kind==='boolean'?[['false','Não'],['true','Sim']]:kind==='enum'?state.options.map(o=>[o.id,o.label]):kind==='trait'?state.scale.map(n=>[String(n),'d'+n]):[];
        const control=choices.length?choose('Valor inicial estruturado',choices,state.initial):input('Valor inicial estruturado',state.initial||'');remember('initial',control.input);initial.append(control.wrap);
        value=()=>kind==='boolean'?control.input.value==='true':['number','integer'].includes(kind)?numberFromText(control.input.value):kind==='trait'?[numberFromText(control.input.value)]:control.input.value;
      };
      if(kind==='enum'){
        const list=el('div'),label=input('Nome da opção estruturada',state.optionLabel||'');remember('optionLabel',label.input);settings.append(list,label.wrap);
        const drawOptions=()=>{list.replaceChildren();for(const [i,option]of state.options.entries())list.append(el('span',option.label),button('Remover opção estruturada '+option.label,()=>{state.options.splice(i,1);drawOptions();drawInitial();view.onPending?.();}));};drawOptions();settings.append(button('Adicionar opção estruturada',()=>{if(!label.input.value.trim())return;state.options.push({id:'option-'+crypto.randomUUID(),label:label.input.value.trim()});drawOptions();drawInitial();view.onPending?.();}));options=()=>({options:structuredClone(state.options)});
      }
      if(kind==='trait'){
        const composite=choose('Traço admite composição',[['false','Um dado'],['true','Vários dados']],state.composite||'false'),list=el('div'),next=input('Novo tamanho de dado','20');remember('composite',composite.input);settings.append(composite.wrap,list,next.wrap);
        const drawScale=()=>{list.replaceChildren();for(const [i,n]of state.scale.entries())list.append(el('span','d'+n),button('Remover d'+n+' da escala',()=>{state.scale.splice(i,1);drawScale();drawInitial();view.onPending?.();}));};drawScale();settings.append(button('Acrescentar tamanho à escala',()=>view.run(()=>{state.scale.push(numberFromText(next.input.value));state.scale.sort((a,b)=>a-b);drawScale();drawInitial();view.onPending?.();})));options=()=>({scale:structuredClone(state.scale),composite:composite.input.value==='true'});
      }
      if(kind==='reference'){
        const catalogField=(pkg.system.catalogs||[]).some(c=>c.id===parent.input.value)||parents.some(r=>r.definition.id===parent.input.value&&r.path[1]==='catalogs');
        const target=choose('Destino da nova referência',[['','Escolha o destino'],...(pkg.system.catalogs||[]).map(c=>['system:'+c.id,c.label+' · catálogo']),...(!catalogField?dataDefinitions(pkg.system).filter(r=>r.definition.type==='collection').map(r=>['character:'+r.definition.id,r.definition.label+' · personagem']):[])],state.target||''),multiple=choose('Quantidade de referências',[['false','Uma'],['true','Várias']],state.multiple||'false');remember('target',target.input);remember('multiple',multiple.input);settings.append(target.wrap,multiple.wrap);
        options=()=>{const [scope,id]=target.input.value.split(':');return {target:scope==='system'?{scope,catalogId:id}:{scope,dataId:id},multiple:multiple.input.value==='true'};};
        settings.append(el('p','Selecione o valor da referência na ficha; ausência inicial é uma escolha explícita.'));
      }
      const restrictions=[];
      for(const [key,label]of (['number','integer'].includes(kind)?[['minimum','Mínimo do novo dado'],['maximum','Máximo do novo dado']]:kind==='string'?[['maxLength','Comprimento máximo do texto']]:kind==='collection'?[['minItems','Mínimo de entradas'],['maxItems','Máximo de entradas']]:[])){
        const control=input(label,state['constraint:'+key]??'');remember('constraint:'+key,control.input);settings.append(control.wrap);restrictions.push([key,control.input]);
      }
      mode.input.addEventListener('change',drawInitial);drawInitial();read=()=>({name:name.input.value,type:kind,required:required.input.value==='true',nullable:nullable.input.value==='true',hasInitial:mode.input.value!=='absent',initial:value(),...options(),...Object.fromEntries(restrictions.filter(([,control])=>control.value!=='').map(([key,control])=>[key,numberFromText(control.value)]))});
    };type.input.addEventListener('change',()=>{state.initialMode='absent';draw();view.onPending?.();});parent.input.addEventListener('change',draw);draw();
    host.append(button('Revisar definição estruturada',()=>view.run(()=>checkedCommit(parent.input.value?addTypedFieldPlan(pkg,parent.input.value,read()):createTypedDataPlan(pkg,read()),'Criar definição tipada'))));
    const catalogName=input('Nome do novo catálogo',state.catalogName||'');remember('catalogName',catalogName.input);host.append(catalogName.wrap,button('Revisar novo catálogo',()=>view.run(()=>checkedCommit(createCatalogPlan(pkg,catalogName.input.value),'Criar catálogo do sistema'))));
    for(const row of definitionPaths(pkg).filter(r=>r.definition.type==='collection')){
      const definition=row.definition,box=el('details');box.append(el('summary','Unicidade de '+definition.label));
      const fields=(definition.fields||[]).map(field=>{const control=input('Valor único · '+definition.label+' · '+field.label,'','checkbox');control.input.checked=(definition.unique||[]).includes(field.id);box.append(control.wrap);return {field,control};});
      box.append(button('Revisar unicidade de '+definition.label,()=>view.run(()=>checkedCommit({commands:[{type:'setProperty',path:[...row.path,'unique'],value:fields.filter(r=>r.control.input.checked).map(r=>r.field.id)}]},'Alterar restrições de unicidade'))));host.append(box);
    }
    for(const [i,catalog]of (pkg.system.catalogs||[]).entries()){
      const row=el('details');row.append(el('summary',catalog.label+' · '+catalog.entries.length+' entradas'));host.append(row);state.catalogDrafts??={};const draft=state.catalogDrafts[catalog.id]??={};
      const readEntry=mountRecordInputs(row,{definition:catalog,system:pkg.system,character:pkg.system.characterTemplate,label:'Nova entrada · '+catalog.label,state:draft,onEdit:()=>view.onPending?.()});
      row.append(button('Adicionar entrada no catálogo '+catalog.label,()=>view.run(()=>{
        const entry={...readEntry(),id:'entry-'+crypto.randomUUID()};
        return checkedCommit({commands:[{type:'insertNode',path:['system','catalogs',i,'entries'],index:catalog.entries.length,value:entry}]},'Adicionar entrada de catálogo');
      })));
      for(const [j,entry]of catalog.entries.entries()){
        const label=catalog.fields.map(field=>entry[field.binding]).filter(v=>v!==undefined&&v!==null&&typeof v!=='object').join(' · ')||entry.id,edit=el('details');edit.append(el('summary','Editar entrada · '+catalog.label+' · '+label));state.catalogEdits??={};const draft=state.catalogEdits[entry.id]??={};
        const read=mountRecordInputs(edit,{definition:catalog,system:pkg.system,character:pkg.system.characterTemplate,label:'Editar entrada · '+catalog.label+' · '+label,state:draft,base:entry,onEdit:()=>view.onPending?.()});
        edit.append(button('Revisar entrada de catálogo '+label,()=>view.run(()=>checkedCommit({commands:[{type:'removeNode',path:['system','catalogs',i,'entries'],index:j},{type:'insertNode',path:['system','catalogs',i,'entries'],index:j,value:{...read(),id:entry.id}}]},'Editar entrada de catálogo'))));
        row.append(edit,button('Remover entrada de catálogo '+label,()=>view.run(()=>checkedCommit({commands:[{type:'removeNode',path:['system','catalogs',i,'entries'],index:j}]},'Remover entrada de catálogo'))));
      }
    }
    const selected=valueAt(pkg,view.selection||[]),compoundName=input('Nome do composto local',state.compoundName||'');remember('compoundName',compoundName.input);host.append(compoundName.wrap);
    if(selected?.type==='group')host.append(button('Revisar grupo como composto local',()=>view.run(()=>checkedCommit(createComponentDefinitionPlan(pkg,view.selection,compoundName.input.value),'Compartilhar apresentação como composto local'))));
    if(selected?.type==='componentInstance')host.append(button('Revisar desvincular composto',()=>view.run(()=>checkedCommit(detachComponentPlan(pkg,view.selection),'Desvincular apresentação mantendo dados'))));
    for(const [i,definition]of (pkg.system.componentDefinitions||[]).entries()){
      const editLabels=(components,path,row)=>{for(const [j,component]of components.entries()){
        const at=[...path,j],label=input('Texto compartilhado · '+definition.label+' · '+(component.label||component.type),state['componentLabel:'+at.join('/')]??component.label??'');remember('componentLabel:'+at.join('/'),label.input);
        row.append(label.wrap,button('Revisar texto compartilhado · '+(component.label||component.type),()=>view.run(()=>checkedCommit({commands:[{type:'setProperty',path:[...at,'label'],value:label.input.value},{type:'setProperty',path:['system','componentDefinitions',i,'revision'],value:definition.revision+1}]},'Editar componente compartilhado'))));
        if(component.type==='group')editLabels(component.components||[],[...at,'components'],row);
      }};
      const row=el('details');row.append(el('summary',definition.label+' · revisão'+definition.revision));const label=input('Rótulo compartilhado de '+definition.label,state['compoundLabel:'+definition.id]??definition.label);remember('compoundLabel:'+definition.id,label.input);row.append(label.wrap,button('Revisar rótulo compartilhado de '+definition.label,()=>view.run(()=>checkedCommit({commands:[{type:'setProperty',path:['system','componentDefinitions',i,'label'],value:label.input.value},{type:'setProperty',path:['system','componentDefinitions',i,'revision'],value:definition.revision+1}]},'Editar apresentação compartilhada'))),button('Revisar copiar definição '+definition.label,()=>view.run(()=>checkedCommit(copyComponentDefinitionPlan(pkg,definition.id),'Copiar definição independente'))));editLabels(definition.components,['system','componentDefinitions',i,'components'],row);host.append(row);
    }
  };
  host.addEventListener('toggle',()=>{state.open=host.open;populate();view.onPending?.();});populate();return host;
}
