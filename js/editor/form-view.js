import {referenceOptions,renameDefinitionPlan,identityPlan,removalImpact,setValueCommands,pointerPath}  from './form-commands.js';
import {Inspector} from './inspector.js';
import {editableDocument,structuralNodes,valueAt,structureCommand,destinations,reconcileSelection,safeKey,KIND_LABELS} from './form-structure.js';
import {nodeSchema} from './form-metadata.js';
import {COMPONENT_CONTRACTS} from '../validation/contracts.js';
import {pointerFor} from './source-map.js';
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const select=(label,options)=>{const wrap=el('label',label),input=el('select');input.setAttribute('aria-label',label);for(const [value,text]of options){const opt=el('option',text);opt.value=value;input.append(opt);}wrap.append(input);return {wrap,input};};

const captureFocus=host=>{
  const active=document.activeElement;if(!host.contains(active))return null;
  return {pointer:active.closest('[data-property]')?.dataset.property,tree:active.closest('[data-pointer]')?.dataset.pointer,label:active.getAttribute('aria-label'),tag:active.tagName,text:active.tagName==='BUTTON'?active.textContent:null,start:active.selectionStart,end:active.selectionEnd};
};
const restoreFocus=(host,state)=>{
  if(!state)return;const scope=state.pointer?host.querySelector('[data-property="'+CSS.escape(state.pointer)+'"]'):host;
  const target=state.tree?host.querySelector('[data-pointer="'+CSS.escape(state.tree)+'"]'):[...(scope?.querySelectorAll(state.tag) || [])].find(node=>state.label?node.getAttribute('aria-label')===state.label:state.text?node.textContent===state.text:!node.hidden);
  const next=target || host.querySelector('[role=treeitem][aria-selected=true]');next?.focus({preventScroll:true});if(next?.setSelectionRange && typeof state.start==='number')try{next.setSelectionRange(state.start,state.end);}catch{}
};
export class FormView {
  constructor(host,{session,onChange,onPending,onJson,confirm}={}) {Object.assign(this,{host,session,onChange,onPending,onJson,confirm});this.pkg=null;this.selection=Object.hasOwn(session.ui,'formSelection')?(Array.isArray(session.ui.formSelection)?session.ui.formSelection:null):['system'];this.selectionSnapshots=new Map();}
  commit(commands,label,selection) {
    if(commands.some(command=>['moveNode','insertNode','removeNode'].includes(command.type)) && Object.keys(this.session.ui.formPending || {}).some(pointer=>pointer!==pointerFor(selection || [])))throw new Error('Aplique ou descarte os textos pendentes antes de reorganizar entradas ou estrutura.');
    this.rememberSelection();
    this.session.operate(commands,{label,expectedRevision:this.session.revision});
    if(selection && structuralNodes(this.session.validation.value).some(node=>node.pointer===pointerFor(selection)))this.selection=selection;
    this.pkg=this.session.validation.value;this.session.ui.formSelection=this.selection;this.onChange();this.refresh(true);
  }
  textKey(text){let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return text.length+':'+a+':'+b;}
  rememberSelection(){if(!this.pkg || !this.selection)return;this.selectionSnapshots.set(this.textKey(this.session.text),{path:[...this.selection],signature:this.textKey(JSON.stringify(valueAt(this.pkg,this.selection)) || '')});while(this.selectionSnapshots.size>52)this.selectionSnapshots.delete(this.selectionSnapshots.keys().next().value);}
  selectPointer(pointer){const pkg=editableDocument(this.session),path=pointerPath(pkg,pointer),nodes=structuralNodes(pkg);const selected=nodes.filter(node=>node.path.length<=path.length && node.path.every((part,index)=>part===path[index])).sort((a,b)=>b.path.length-a.path.length)[0];if(selected){this.pkg=pkg;this.selection=selected.path;this.session.ui.formSelection=this.selection;this.rememberSelection();}return selected;}
  refresh(explicit=false) {
    const focus=captureFocus(this.host);
    let pkg;try{pkg=editableDocument(this.session);}catch(error){this.host.replaceChildren(el('p',error.message,'editor-note'));return;}
    if(this.pkg && !explicit){const snapshot=this.selectionSnapshots.get(this.textKey(this.session.text));if(snapshot && this.textKey(JSON.stringify(valueAt(pkg,snapshot.path)) || '')===snapshot.signature)this.selection=snapshot.path;else this.selection=reconcileSelection(this.pkg,pkg,this.selection);}
    this.pkg=pkg;this.session.ui.formSelection=this.selection;
    this.host.replaceChildren();
    this.rememberSelection();
    const nodes=structuralNodes(pkg),selected=this.selection?nodes.find(node=>node.pointer===pointerFor(this.selection)):undefined;
    const tree=el('div','','editor-structure');tree.append(el('h2','Estrutura do pacote'));const list=el('div','','editor-tree');list.setAttribute('role','tree');list.setAttribute('aria-label','Layouts, abas, seções e componentes');
    for(const node of nodes){const item=el('button',KIND_LABELS[node.kind]+' · '+node.title);item.type='button';item.setAttribute('role','treeitem');item.setAttribute('aria-level',String(['system','package'].includes(node.kind)?1:node.path.filter(x=>typeof x==='number').length));item.setAttribute('aria-selected',String(node===selected));item.tabIndex=node===selected || !selected && node===nodes[0]?0:-1;item.dataset.pointer=node.pointer;item.style.setProperty('--tree-level',String(Math.max(0,node.path.filter(x=>typeof x==='number').length-1)));item.addEventListener('click',()=>{this.selection=node.path;this.session.ui.formSelection=node.path;this.refresh(true);this.host.querySelector('[data-pointer="'+CSS.escape(node.pointer)+'"]')?.focus();this.onPending?.();});list.append(item);}
    list.addEventListener('keydown',event=>{const items=[...list.children],index=items.indexOf(document.activeElement);let next=index;
      if(event.key==='ArrowDown')next=Math.min(items.length-1,index+1);else if(event.key==='ArrowUp')next=Math.max(0,index-1);else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else if(event.key==='ArrowLeft'){const parent=nodes[index]?.parent;next=nodes.findIndex(n=>n.pointer===parent);if(next<0)next=index;}else if(event.key==='ArrowRight'){if(nodes[index+1]?.parent===nodes[index]?.pointer)next=index+1;}else return;
      event.preventDefault();items[index].tabIndex=-1;items[next].tabIndex=0;items[next].focus();});tree.append(list);this.host.append(tree);
    const right=el('section','','editor-inspector');this.host.append(right);
    if(!selected){right.append(el('p','Seleção anterior ausente ou ambígua. Escolha um bloco da árvore.'));restoreFocus(this.host,focus);return;}
    const tools=el('div','','editor-structure-actions');
    const action=(label,fn)=>{const button=el('button',label,'button button--ghost');button.type='button';button.addEventListener('click',()=>this.run(fn));tools.append(button);return button;};
    const types=select('Tipo do novo componente',Object.keys(COMPONENT_CONTRACTS).map(type=>[type,type+' — '+COMPONENT_CONTRACTS[type].summary]));if(selected.kind==='container')tools.append(types.wrap);
    if(!['component','package'].includes(selected.kind))action({system:'Adicionar layout',layout:'Adicionar aba',tab:'Adicionar seção',section:'Adicionar grupo',container:'Adicionar componente'}[selected.kind],()=>{const command=structureCommand(pkg,selected,'add',{type:types.input.value});this.commit(command.commands,'Adicionar estrutura',command.selection);});
    if(!['system','package'].includes(selected.kind)){
      action('Duplicar bloco',()=>{const command=structureCommand(pkg,selected,'duplicate');this.commit(command.commands,'Duplicar estrutura',command.selection);});
      action('Remover bloco',async()=>{const revision=this.session.revision,impact=removalImpact(pkg,selected.path);if(await this.confirm('Remover '+selected.title+'? '+impact.incoming.length+' usos de entrada, '+impact.outgoing.length+' referências no bloco. '+impact.notes.join(' '))){if(revision!==this.session.revision)throw new Error('Revisão mudou durante confirmação.');const command=structureCommand(pkg,selected,'remove');this.commit(command.commands,'Remover estrutura',command.selection);}});
      const options=destinations(pkg,selected.kind),dest=select('Destino do bloco',options.map(item=>[pointerFor(item.path),item.title]));dest.input.value=pointerFor(selected.path.slice(0,-1));tools.append(dest.wrap);
      const position=el('input');position.type='number';position.min=0;position.value=this.session.ui.formInputs?.[selected.pointer+'::position'] ?? String(selected.path.at(-1));position.addEventListener('input',()=>{this.session.ui.formInputs??={};this.session.ui.formInputs[selected.pointer+'::position']=position.value;this.onPending?.();});position.setAttribute('aria-label','Posição no destino (começa em 0)');tools.append(position);
      action('Mover bloco',()=>{const destination=options.find(item=>pointerFor(item.path)===dest.input.value)?.path,command=structureCommand(pkg,selected,'move',{destination,to:Number(position.value)});this.commit(command.commands,'Mover estrutura',command.selection);});
      action('Subir bloco',()=>{const command=structureCommand(pkg,selected,'move',{destination:selected.path.slice(0,-1),to:Math.max(0,selected.path.at(-1)-1)});this.commit(command.commands,'Mover estrutura',command.selection);});
      action('Descer bloco',()=>{const command=structureCommand(pkg,selected,'move',{destination:selected.path.slice(0,-1),to:Math.min(valueAt(pkg,selected.path.slice(0,-1)).length-1,selected.path.at(-1)+1)});this.commit(command.commands,'Mover estrutura',command.selection);});
    }
    if(selected.kind==='system'){
      const dataKey=el('input');dataKey.type='text';dataKey.setAttribute('aria-label','Nome do catálogo ou tabela');dataKey.value=this.session.ui.formInputs?.catalogName ?? '';dataKey.addEventListener('input',()=>{this.session.ui.formInputs??={};this.session.ui.formInputs.catalogName=dataKey.value;this.onPending?.();});const dataType=select('Formato do catálogo ou tabela',[['array','Lista'],['object','Tabela por chave']]);tools.append(dataKey,dataType.wrap);
      const existing=select('Catálogo ou tabela existente',Object.keys(pkg.system).filter(key=>!nodeSchema('system')[key]&&!['extensions','metadata','extra','extras','manifest'].includes(key)&&pkg.system[key]&&typeof pkg.system[key]==='object').map(key=>[key,key]));tools.append(existing.wrap);
      action('Editar catálogo ou tabela existente',()=>{const key=existing.input.value;if(!key)throw new Error('Nenhum catálogo adicional disponível.');this.session.ui.formDataKeys??=[];if(!this.session.ui.formDataKeys.includes(key))this.session.ui.formDataKeys.push(key);this.refresh(true);this.onPending?.();});
      action('Criar catálogo ou tabela',()=>{const key=safeKey(dataKey.value);if(Object.hasOwn(pkg.system,key))throw new Error('Propriedade já existente.');this.session.ui.formDataKeys??=[];this.session.ui.formDataKeys.push(key);this.session.ui.formInputs??={};this.session.ui.formInputs.catalogName='';this.commit([{type:'setProperty',path:['system',key],value:dataType.input.value==='array'?[]:{}}],'Criar catálogo');});
    }
    if(selected.kind==='component')for(const key of ['configFrom','actionsFrom','presetsFrom','traitsFrom']){
      const link=selected.value?.[key] ?? COMPONENT_CONTRACTS[selected.value?.type]?.properties[key]?.default;
      if(typeof link!=='string')continue;
      const parts=link.replace(/^system\./,'').split('.');
      action('Editar regra compartilhada: '+key,()=>{if(valueAt(pkg,['system',...parts])===undefined)throw new Error('Definição inexistente. Configure o sistema antes de vincular.');this.selection=['system'];this.session.ui.formOpen??={};for(let i=1;i<=parts.length;i++)this.session.ui.formOpen[pointerFor(['system',...parts.slice(0,i)])]=true;this.refresh(true);this.host.querySelector('[data-property="'+CSS.escape(pointerFor(['system',...parts]))+'"]')?.scrollIntoView({block:'nearest'});});
    }
    right.append(tools);const inspectorHost=el('div');right.append(inspectorHost);
    this.inspector=new Inspector(inspectorHost,{session:this.session,commit:(commands,label,path)=>this.edit(commands,label,path),onPending:(rerender,message)=>{this.onPending?.(rerender,message);if(rerender)this.refresh(true);},onJson:this.onJson,rename:(path,key)=>this.rename(path,key),remove:path=>this.removeProperty(path),referenceOptions:(path,key)=>referenceOptions(pkg,path,key)});const schema=nodeSchema(selected.kind,selected.value);if(selected.kind==='system')for(const key of (Array.isArray(this.session.ui.formDataKeys)?this.session.ui.formDataKeys:[]))if(Object.hasOwn(pkg.system,key)&&!schema[key])schema[key]={type:'any',label:key};this.inspector.render(pkg,selected,schema);restoreFocus(this.host,focus);
  }
  async edit(commands,label,path) {
    if(path?.at(-1)==='id' && commands[0]?.type==='setProperty' && valueAt(this.pkg,path)!==commands[0].value){
      const plan=identityPlan(this.pkg,path,commands[0].value),revision=this.session.revision;
      if(!await this.confirm('Alterar identidade? '+plan.notes.join(' ')+'\n'+plan.usages.map(u=>u.pointer).join('\n')))return false;
      if(this.session.revision!==revision)throw new Error('Revisão mudou durante confirmação.');this.commit(plan.commands,label);return true;
    }
    this.commit(commands,label,path);return true;
  }
  async rename(path,key) {
    const plan=renameDefinitionPlan(this.pkg,path,key),revision=this.session.revision;
    if(!plan.commands.length)return;
    if(await this.confirm('Renomear '+path.at(-1)+' para '+key+'? '+plan.usages.length+' usos conhecidos.\n'+plan.usages.map(u=>u.pointer).join('\n')+'\n'+plan.notes.join(' '))){if(this.session.revision!==revision)throw new Error('Revisão mudou durante confirmação.');this.commit(plan.commands,'Renomear definição');}
  }
  async removeProperty(path) {
    const impact=removalImpact(this.pkg,path),revision=this.session.revision;
    if(impact.incoming.length || impact.outgoing.length){if(!await this.confirm('Remover '+pointerFor(path)+'? '+impact.incoming.length+' usos conhecidos apontam para este bloco.\n'+impact.incoming.map(u=>u.pointer).join('\n')+'\n'+impact.notes.join(' ')))return;}
    if(this.session.revision!==revision)throw new Error('Revisão mudou durante confirmação.');this.commit(setValueCommands(this.pkg,path,null,true),'Remover propriedade',path);delete this.session.ui.formPending?.[pointerFor(path)];this.onPending?.(true);
  }
  async run(fn){try{await fn();}catch(error){this.onPending?.(false,error.message);}}
}
