import {editorShortcut} from './keyboard-shortcuts.js';
import {pointerFor} from './source-map.js';
import {structuralNodes} from './form-structure.js';
import {openModal} from '../modal.js';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
const button=(label,fn)=>{const n=el('button',label,'button button--ghost');n.type='button';n.addEventListener('click',fn);return n;};
const editing=target=>Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]'));
const modal=()=>[...document.querySelectorAll('.modal-overlay,dialog:modal,[aria-modal=true]')].some(n=>n.getClientRects().length>0);
export class WorkspaceInteractions{
 constructor(workspace){
  this.workspace=workspace;this.editor=workspace.editor;this.root=workspace.root;
  document.addEventListener('keydown',this.onKey=e=>{
   if(this.root.hidden||!this.root.isConnected||!this.root.contains(e.target)&&e.target!==document.body||modal())return;
   if(e.key==='Escape'){if(this.menu){e.preventDefault();this.closeMenu();return;}if(this.watch?.contains(e.target)){e.preventDefault();this.closeWatch();return;}}
   const action=editorShortcut(e,{editing:editing(e.target),area:workspace.state.area});if(!action)return;
   e.preventDefault();e.stopPropagation();this.closeMenu(false);this.execute(action);
  });
  this.root.addEventListener('contextmenu',this.onContext=e=>{const node=e.target.closest('[role=treeitem][data-pointer]');if(workspace.state.area!=='sheet'||!node||modal())return;e.preventDefault();this.showMenu(node.dataset.pointer,e.clientX,e.clientY);});
  this.root.addEventListener('pointerdown',this.onPointer=e=>{if(this.menu&&!this.menu.contains(e.target))this.closeMenu(false);});
  const menu=this.root.querySelector('.workspace-technical .workspace-menu-body');menu.append(button('Acompanhar JSON',()=>this.openWatch()),button('Atalhos do editor',()=>this.help()));
  this.editor.undo.setAttribute('aria-keyshortcuts','Control+z Meta+z');this.editor.redo.setAttribute('aria-keyshortcuts','Control+Shift+z Meta+Shift+z Control+y');
  this.resize=()=>{if(this.watch)this.clampWatch();this.closeMenu(false);};window.addEventListener('resize',this.resize);
 }
 selected(){return structuralNodes(this.editor.forms.pkg||{}).find(n=>n.pointer===pointerFor(this.editor.forms.selection||[]));}
 actionButton(action){return [...this.editor.formsHost.querySelectorAll('.editor-structure-actions button')].find(n=>n.textContent===({remove:'Remover bloco',duplicate:'Duplicar bloco'})[action]);}
 execute(action){
  const e=this.editor,w=this.workspace;if(modal())return;
  if(action==='save'){e.run(()=>e.saveDraft());return;}
  if(action==='shortcuts'){this.help();return;}
  if(action==='undo'||action==='redo'){e.run(()=>{e.session.replay(action);e.changed(true);});return;}
  if(w.state.area!=='sheet')return;
  if(action==='add'){w.startAdding();return;}
  if(action==='context'){const item=this.root.querySelector('[role=treeitem][aria-selected=true]'),r=item?.getBoundingClientRect();this.showMenu(pointerFor(e.forms.selection||[]),r?.left||innerWidth/2,r?.bottom||innerHeight/2);return;}
  if(action==='properties'||action==='rename'){
   w.state.panel='properties';w.applyPanels();const field=this.root.querySelector('.workspace-properties input[aria-label="Rótulo"],.workspace-properties input[aria-label="Título"],.workspace-properties input[aria-label="Nome"]');
   if(field){field.focus();if(action==='rename')field.select();}return;
  }
  if(['remove','duplicate'].includes(action)){
   const target=this.actionButton(action);if(!target||Object.keys(e.session.ui.formPending||{}).length){e.status.textContent=target?'Aplique ou descarte os campos pendentes antes de reorganizar a ficha.':'Selecione um elemento que possa ser '+(action==='remove'?'removido.':'duplicado.');return;}
   target.click();
  }
 }
 fromPreview(message){
  const e=this.editor;if(this.workspace.state.area!=='sheet'||e.session.ui.mode!=='visual'||!e.navigationReady()||modal())return;
  if(message.pointer)e.pickSource(message,{reveal:message.type!=='authoring-context'});
  if(message.type==='authoring-context'){
   const frame=e.preview.current.frame,r=frame.getBoundingClientRect(),style=getComputedStyle(frame),sx=r.width/parseFloat(style.width)||1,sy=r.height/parseFloat(style.height)||1;this.showMenu(message.pointer,r.left+message.x*sx,r.top+message.y*sy,frame);
  }else if(['save','undo','redo','duplicate','remove','add','properties','rename','context','shortcuts'].includes(message.action))this.execute(message.action);
 }
 showMenu(pointer,x,y,returnFocus=document.activeElement){
  const e=this.editor,w=this.workspace;if(w.state.area!=='sheet'||modal())return;const selected=e.forms.selectPointer(pointer);if(!selected||['system','package'].includes(selected.kind))return;
  this.closeMenu(false);this.menuReturnFocus=returnFocus;e.forms.refresh(true);w.applyPanels();this.menuRevision=e.session.revision;
  const menu=el('div','','workspace-context-menu');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Ações de '+selected.title);this.menu=menu;
  const add=(label,fn,disabled=false)=>{const n=button(label,()=>{this.closeMenu(false);if(this.menuRevision!==e.session.revision)return;e.run(fn);});n.setAttribute('role','menuitem');n.disabled=disabled;menu.append(n);};
  add('Editar propriedades',()=>this.execute('properties'));add('Mostrar na ficha',()=>e.showSourceInPreview());
  const pending=Object.keys(e.session.ui.formPending||{}).length>0;
  add('Duplicar · Ctrl/⌘ D',()=>this.execute('duplicate'),pending||!this.actionButton('duplicate'));
  add('Remover · Delete',()=>this.execute('remove'),pending||!this.actionButton('remove'));
  add('Abrir definição no JSON',()=>e.openFormJson(selected.path));add('Acompanhar JSON',()=>this.openWatch());
  if(pending)menu.append(el('small','Aplique ou descarte os campos pendentes para duplicar ou remover.'));
  menu.addEventListener('keydown',event=>{const items=[...menu.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(i+1)%items.length;else if(event.key==='ArrowUp')next=(i+items.length-1)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else return;event.preventDefault();event.stopPropagation();items[next].focus();});
  this.root.append(menu);this.placeFloating(menu,x,y);menu.querySelector('button').focus();
 }
 closeMenu(focus=true){if(!this.menu)return;this.menu.remove();this.menu=null;if(focus){const candidates=[this.menuReturnFocus,this.root.querySelector('[role=treeitem][aria-selected=true]'),this.root.querySelector('.editor-preview-frame:not([hidden])'),this.root.querySelector('.workspace-panel-nav [aria-pressed=true]')];candidates.find(n=>n&&n!==document.body&&n.isConnected&&n.getClientRects().length)?.focus({preventScroll:true});}this.menuReturnFocus=null;}
 help(){const content=el('div','','system-removal-review');for(const [keys,label]of [['Delete','Remover seleção com confirmação'],['Ctrl/⌘ D','Duplicar seleção'],['F2','Editar o nome da seleção'],['A ou Insert','Adicionar elemento'],['P','Propriedades da seleção'],['Shift F10','Menu do elemento'],['Ctrl/⌘ Z','Desfazer'],['Ctrl/⌘ Shift Z ou Ctrl Y','Refazer'],['Ctrl/⌘ S','Salvar rascunho'],['?','Mostrar atalhos'],['Esc','Fechar menu ou janela em foco']]){const row=el('p');row.append(el('kbd',keys),document.createTextNode(' — '+label));content.append(row);}content.append(el('p','Atalhos de elemento atuam em Ficha. Ao digitar, Delete e desfazer continuam editando o texto. Campos pendentes não são aplicados pelo atalho.'));openModal({title:'Atalhos do editor',contentEl:content});}
 openWatch(){
  if(this.watch){this.watchArea.focus();return;}
  const panel=el('section','','workspace-json-watch');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','workspace-json-watch-title');
  const header=el('header'),title=el('h2','JSON em tempo real');title.id='workspace-json-watch-title';const handle=el('div','','workspace-watch-handle');handle.tabIndex=0;handle.setAttribute('aria-label','Mover janela JSON; use as setas');handle.append(title);header.append(handle,button('Fechar JSON',()=>this.closeWatch()));
  const note=el('p','Somente leitura. Campos pendentes entram no arquivo ao aplicar ou confirmar.');this.watchArea=el('textarea');this.watchArea.readOnly=true;this.watchArea.spellcheck=false;this.watchArea.setAttribute('aria-label','JSON em tempo real, somente leitura');panel.append(header,note,this.watchArea);this.root.append(panel);this.watch=panel;this.watchObserver=new ResizeObserver(()=>{if(this.watch)this.clampWatch();});this.watchObserver.observe(panel);this.refresh();this.watchArea.focus();
  let drag;handle.addEventListener('pointerdown',event=>{if(event.button!==0)return;const r=panel.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:r.left,top:r.top};handle.setPointerCapture(event.pointerId);event.preventDefault();});
  handle.addEventListener('pointermove',event=>{if(!drag)return;this.placeFloating(panel,drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y);});for(const name of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(name,()=>{drag=null;});
  handle.addEventListener('keydown',event=>{const deltas={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]},delta=deltas[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();const r=panel.getBoundingClientRect();this.placeFloating(panel,r.left+delta[0],r.top+delta[1]);});this.clampWatch();
 }
 placeFloating(panel,x,y){
  const scale=panel.getBoundingClientRect().width/parseFloat(getComputedStyle(panel).width)||1,maxWidth=Math.max(1,(innerWidth-16)/scale),maxHeight=Math.max(1,(innerHeight-16)/scale);
  panel.style.maxWidth=maxWidth+'px';panel.style.minWidth=Math.min(panel===this.watch?280:240,maxWidth)+'px';panel.style.maxHeight=maxHeight+'px';if(panel===this.watch)panel.style.minHeight=Math.min(200,maxHeight)+'px';
  const r=panel.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))/scale+'px';panel.style.top=Math.max(8,Math.min(y,innerHeight-r.height-8))/scale+'px';
 }
 clampWatch(){const r=this.watch.getBoundingClientRect();this.placeFloating(this.watch,r.left,r.top);}
 closeWatch(){this.watchObserver?.disconnect();this.watchObserver=null;this.watch?.remove();this.watch=null;this.root.querySelector('.workspace-technical>summary')?.focus();}
 refresh(){if(this.menu&&this.menuRevision!==this.editor.session.revision)this.closeMenu(false);if(this.watchArea&&this.watch&&this.watchArea.value!==this.editor.session.text){const n=this.watchArea,start=n.selectionStart,end=n.selectionEnd,top=n.scrollTop,left=n.scrollLeft;n.value=this.editor.session.text;n.setSelectionRange(Math.min(start,n.value.length),Math.min(end,n.value.length));n.scrollTop=top;n.scrollLeft=left;}}
 destroy(){this.watchObserver?.disconnect();this.menu?.remove();this.watch?.remove();document.removeEventListener('keydown',this.onKey);this.root.removeEventListener('contextmenu',this.onContext);this.root.removeEventListener('pointerdown',this.onPointer);window.removeEventListener('resize',this.resize);}
}
