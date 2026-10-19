import {WorkspaceInteractions} from './workspace-interactions.js';
import {icons} from '../icons.js';
import {WORKSPACE_AREAS,DOMAIN_PANELS,recoverWorkspace,workspaceMode,diagnosticDestination} from './workspace-state.js';
import {nodeSchema} from './form-metadata.js';
import {pointerFor} from './source-map.js';
import {structuralNodes} from './form-structure.js';
import {setValueCommands} from './form-commands.js';
const el=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
function glyph(n,name){if(icons[name]){const span=el('span','','workspace-icon');span.innerHTML=icons[name];n.prepend(span);}return n;}
function button(text,fn,icon,className='button button--ghost'){const n=el('button',text,className);n.type='button';glyph(n,icon);if(typeof fn==='function')n.addEventListener('click',fn);return n;}
function details(title,className=''){const n=el('details','',className);n.append(el('summary',title));return n;}
const vis=n=>n&&n.getClientRects().length>0;

/** Presentation adapter: all editing continues through JsonEditor/FormView. */
export class EditorWorkspace {
 constructor(editor,{entryMode}={}){
  this.editor=editor;this.root=editor.host;this.state=editor.session.ui.workspace=recoverWorkspace({...editor.session.ui,mode:entryMode},editor.session.source,Boolean(editor.session.lastValid));this.scrolls=new Map();this.frames=new Map();this.cleanups=[];this.root.classList.add('editor-workspace');document.body.classList.add('editor-workspace-open');
  this.body=this.root.querySelector('.editor-body');this.source=this.root.querySelector('.editor-source');this.header=this.root.querySelector('.editor-header');this.mountHeader();this.mountAreas();this.mountTools();this.mountReview();this.mountOverview();
  const previous=editor.forms.onVisualRender;editor.forms.onVisualRender=(pkg,selected)=>{previous?.(pkg,selected);this.arrangeForms(pkg,selected);};
  editor.forms.beforeRender=()=>{this.capture();this.scrollRestorePending=true;};editor.forms.afterRender=()=>this.refresh();
  this.root.addEventListener('click',this.onClick=e=>{const tree=e.target.closest('[role=treeitem]');if(tree&&this.state.area==='sheet'){this.state.panel='properties';this.applyPanels();}for(const menu of this.root.querySelectorAll('.workspace-menu[open],.workspace-display[open]'))if(!menu.contains(e.target)||e.target.closest('.workspace-menu-body button')){const command=e.target.closest('.workspace-menu-body button');menu.open=false;if(command)queueMicrotask(()=>{if(!document.querySelector('.modal-overlay:not([hidden]),dialog[open]')&&(document.activeElement===command||document.activeElement===document.body))menu.querySelector('summary')?.focus({preventScroll:true});});}});
  this.observer=new ResizeObserver(()=>this.measure());this.observer.observe(this.header);this.observer.observe(this.nav);this.resize=()=>this.measure();window.visualViewport?.addEventListener('resize',this.resize);window.addEventListener('resize',this.resize);
  this.root.addEventListener('keydown',this.onKey=e=>{if(e.key==='Escape'){for(const d of this.root.querySelectorAll('.workspace-menu[open],.workspace-display[open]')){d.open=false;d.querySelector('summary').focus();}}});
  this.root.addEventListener('scroll',this.onScroll=e=>{if(e.target.dataset?.workspaceScroll&&vis(e.target))this.scrolls.set(this.state.area+':'+e.target.dataset.workspaceScroll,e.target.scrollTop);},true);
  editor.tabs.querySelector('[data-panel=diagnostics]').addEventListener('click',()=>this.goto('review'));
  this.layoutSelections=new Map();this.onLayout=()=>{if(this.state.area==='sheet'){this.rememberSheet();this.selectLayout();this.editor.scheduleDraft();}};editor.layout.addEventListener('change',this.onLayout);
  this.goto(this.state.area,{initial:true});this.interactions=new WorkspaceInteractions(this);
 }
 mountHeader(){
  const e=this.editor,commands=[...this.root.querySelectorAll('.editor-actions button')];this.commands=commands;
  this.header.replaceChildren();const back=button('','',null);back.addEventListener('click',()=>e.run(()=>e.exit()));back.setAttribute('aria-label','Voltar a Sistemas');back.title='Voltar a Sistemas';glyph(back,'back');back.classList.add('workspace-icon-button');
  const identity=el('div','','workspace-identity');this.name=el('h1');identity.append(this.name,e.status);this.header.append(back,identity);
  const actions=el('div','','workspace-header-actions'),history=el('div','','workspace-history');for(const [n,name,ic]of [[e.undo,'Desfazer no editor','undo'],[e.redo,'Refazer no editor','redo']]){n.textContent='';n.setAttribute('aria-label',name);n.title=name;glyph(n,ic);n.classList.add('workspace-icon-button');history.append(n);}actions.append(history);
  this.file=details('Arquivo','workspace-menu');glyph(this.file.firstChild,'document');const fileBody=el('div','','workspace-menu-body');this.file.append(fileBody);
  const group=(label,nodes)=>{fileBody.append(el('span',label,'workspace-menu-label'));fileBody.append(...nodes);};
  group('Rascunho neste navegador',[commands[7],commands[8],commands[9]]);fileBody.append(el('small','Fora de Exportar tudo. Baixar rascunho preserva os textos pendentes.'));
  group('Pacote do sistema',[commands[10],commands[11]]);group('Recuperação',[commands[5],commands[6]]);group('Navegação',[button('Configurações de aparência',()=>e.run(()=>e.exit('settings')),'settings'),commands[13]]);
  actions.append(this.file);this.primary=button('Revisar',()=>e.run(()=>{const inclusion=this.root.querySelector('.workspace-first-element .editor-toolbox-form>button');if(this.state.area==='sheet'&&inclusion){inclusion.click();return;}return this.state.area==='review'?e.applyPackage():this.goto('review');}),'checklist','button button--primary');actions.append(this.primary);this.header.append(actions);
  this.technical=details('Código e propriedades','workspace-menu workspace-technical');this.technical.firstChild.textContent='Código';this.technical.firstChild.append(el('span',' e propriedades','workspace-technical-label'));this.technical.firstChild.setAttribute('aria-label','Código e propriedades');glyph(this.technical.firstChild,'code');const techBody=el('div','','workspace-menu-body');this.technical.append(techBody);techBody.append(e.modes);
  for(const n of e.modes.children){if(['visual','experiment'].includes(n.dataset.mode)){n.hidden=true;continue;}n.addEventListener('click',()=>{this.state.technicalMode=n.dataset.mode;this.goto('code');this.technical.open=false;});}
  techBody.append(el('span','Ferramentas do JSON','workspace-menu-label'),commands[2],commands[3],commands[4],e.title);
  this.primary.hidden=false;
 }
 mountAreas(){
  this.nav=el('nav','','workspace-nav');this.nav.setAttribute('aria-label','Áreas de autoria');this.areaButtons=new Map();const links=el('div','','workspace-area-links');for(const [id,label,ic]of WORKSPACE_AREAS){const n=button(label,()=>this.editor.run(()=>this.goto(id)),ic);n.dataset.workspaceArea=id;links.append(n);this.areaButtons.set(id,n);}
  const label=el('label','Área','workspace-area-select');this.areaSelect=el('select');this.areaSelect.setAttribute('aria-label','Área de autoria');for(const [id,name]of [...WORKSPACE_AREAS,['code','Código e propriedades']]){const o=el('option',name);o.value=id;this.areaSelect.append(o);}this.areaSelect.addEventListener('change',()=>this.editor.run(()=>this.goto(this.areaSelect.value)));label.append(this.areaSelect);this.nav.append(links,label,this.technical);this.header.after(this.nav);
  this.panelNav=el('div','','workspace-panel-nav');this.panelButtons=[];for(const [id,name,ic]of [['canvas','Ficha','document'],['tools','Ferramentas','grid'],['properties','Propriedades','settings']]){const n=button(name,()=>{this.capture();this.state.panel=id;this.applyPanels();this.restore();this.editor.scheduleDraft();},ic);n.dataset.workspacePanel=id;this.panelNav.append(n);this.panelButtons.push(n);}this.nav.after(this.panelNav);
  this.footer=el('footer','','workspace-footer');this.footerPreview=el('span');this.pendingLink=button('Ver revisão',()=>this.goto('review'));this.footer.append(this.footerPreview,this.pendingLink);this.root.append(this.footer);
  this.root.querySelector('.editor-split').classList.add('workspace-code-split');
 }
 mountTools(){
  const e=this.editor;this.display=details('Exibição','workspace-display');glyph(this.display.firstChild,'settings');const inner=el('div');this.display.append(inner);inner.append(e.theme.closest('label'),e.width.closest('label'));this.previewTools=e.previewSection.querySelector('.editor-preview-tools');this.previewTools.prepend(this.display);
  this.previewTools.append(e.showPreview);this.updateButton=[...this.previewTools.querySelectorAll('button')].find(n=>n.textContent==='Atualizar / reiniciar ensaio');
  this.previewHint=e.previewSection.querySelector('.editor-note');
  this.previewTitle=e.previewSection.querySelector('h2');
  this.testIntro=el('p','Amostra isolada. Alterar valores aqui não muda seus personagens nem os valores iniciais. Atualizar o ensaio recria a amostra.','workspace-test-intro');this.previewTools.before(this.testIntro);
  this.emptySheet=el('div','','workspace-empty-sheet');this.emptySheet.append(el('h2','Sua ficha começa aqui'),el('p','Adicione um campo para preencher ou uma orientação para ler. Os dados e as regras podem ser configurados depois.','editor-note'),button('Adicionar primeiro elemento',()=>this.startAdding(),'plus','button button--primary'),button('Começar pelos dados',()=>this.goto('data'),'table'));e.frameWrap.before(this.emptySheet);
 }
 startAdding(){
  const e=this.editor;if(this.state.area!=='sheet')this.goto('sheet');const pkg=e.forms.pkg,index=pkg?.layouts.findIndex(l=>l.id===e.layout.value);if(!pkg)return;
  this.state.firstElement=!structuralNodes(pkg).some(n=>n.kind==='component'&&n.path[1]===index);this.state.tool='add';this.state.panel=this.state.firstElement?'canvas':'tools';e.session.ui.authoringInputs??={};e.session.ui.authoringInputs.configuring=true;e.forms.refresh(true);this.applyPanels();e.scheduleDraft();const field=this.root.querySelector(this.state.firstElement?'.workspace-first-element input[aria-label="Nome mostrado na ficha"]':'.workspace-tools input[aria-label="Buscar componente por finalidade"]');field?.focus();
 }
 mountReview(){
  const e=this.editor;this.review=el('section','','workspace-review');this.review.append(el('h2','Revisar antes de usar'),el('p','Confira pendências, ensaio e impacto na biblioteca. Exportar um pacote e aplicar um sistema têm condições próprias.','editor-note'));
  this.blockReason=el('p','','workspace-block-reason');this.blockReason.id='workspace-apply-reason';this.primary.setAttribute('aria-describedby',this.blockReason.id);
  this.review.append(this.blockReason,e.pendingList,e.readiness,e.diagnostics,e.migration.host,e.applicationStatus);e.readiness.open=true;this.root.append(this.review);
 }
 mountOverview(){
  this.overview=el('section','','workspace-overview');this.overview.append(el('p','Autoria do sistema','workspace-eyebrow'),el('h2','Dê forma ao seu sistema'),el('p','Comece pela ficha ou pelos dados. Você pode voltar a qualquer área; regras automáticas são opcionais.','editor-note'));
  const layout=el('div','','workspace-overview-columns'),identity=el('div'),guide=el('div');identity.append(el('h3','Identidade do sistema'));const label=el('label','Nome do sistema');this.systemName=el('input');this.systemName.setAttribute('aria-label','Nome do sistema');label.append(this.systemName);identity.append(label);
  this.systemName.addEventListener('input',()=>{this.editor.session.ui.formPending??={};this.editor.session.ui.formPending['/system/name']={mode:'value',raw:this.systemName.value};this.editor.refreshPending();this.editor.scheduleDraft();});
  const apply=button('Aplicar nome',()=>this.editor.run(async()=>{if(!this.systemName.value.trim())throw Error('Informe o nome do sistema.');await this.editor.forms.edit(setValueCommands(this.editor.session.validation.value,['system','name'],this.systemName.value),'Editar nome',['system','name']);delete this.editor.session.ui.formPending?.['/system/name'];this.editor.refreshPending();}));
  const discard=button('Descartar',()=>{delete this.editor.session.ui.formPending?.['/system/name'];this.refresh();this.editor.refreshPending();this.editor.scheduleDraft();});const actions=el('div','','workspace-inline-actions');actions.append(apply,discard);identity.append(actions);
  this.overviewCounts=el('div','','workspace-counts');identity.append(this.overviewCounts,button('Descrição e identificação técnica',()=>{this.goto('code');this.editor.setMode('forms');this.editor.forms.selection=['system'];this.editor.forms.refresh(true);},'settings'));
  guide.append(el('h3','Seu próximo passo'));for(const [id,title,description]of [['sheet','Monte a ficha','Organize o que será lido e preenchido.'],['test','Experimente','Confira valores e resultados com uma amostra isolada.'],['review','Revise antes de usar','Corrija pendências e confira o impacto.']]){const row=el('div','','workspace-step');row.append(button(title,()=>this.goto(id),WORKSPACE_AREAS.find(([a])=>a===id)?.[2]),el('p',description,'editor-note'));guide.append(row);}layout.append(identity,guide);this.overview.append(layout);this.root.append(this.overview);
 }
 capture(){
  if(!this.state)return;const area=this.root.dataset.workspaceArea||this.state.area;for(const n of this.root.querySelectorAll('[data-workspace-scroll]'))if(vis(n))this.scrolls.set(area+':'+n.dataset.workspaceScroll,n.scrollTop);
 }
 restore(){for(const n of this.root.querySelectorAll('[data-workspace-scroll]'))if(vis(n))n.scrollTop=this.scrolls.get(this.state.area+':'+n.dataset.workspaceScroll)||0;this.scrollRestorePending=false;}
 goto(area,{initial=false}={}){
  if(![...WORKSPACE_AREAS.map(([id])=>id),'code'].includes(area))return;
  const e=this.editor;this.capture();e.gestures?.cancel();const old=this.state.area;if(old==='sheet'&&area!=='sheet')this.state.sheetSelection=e.forms.selection;this.state.area=area;e.forms.compact=area==='sheet';if(['data','rules'].includes(area)&&old!==area)this.state.panel='properties';const mode=area==='review'?e.session.ui.mode:workspaceMode(area,this.state.technicalMode);this.navigating=true;
  try{if(e.session.ui.mode!==mode)e.setMode(mode,true);else if(mode==='visual'&&!e.forms.pkg)e.forms.refresh();if(e.session.ui.mode!==mode){this.state.area='code';this.state.technicalMode=e.session.ui.mode;e.status.textContent='Corrija o documento em Código e propriedades antes de continuar a autoria visual. O texto permanece preservado.';}}
  catch(error){this.state.area='code';this.state.technicalMode='json';e.setMode('json',true);e.status.textContent=error.message;}
  finally{this.navigating=false;}
  e.forms.compact=this.state.area==='sheet';if(this.state.area==='sheet'&&e.forms.pkg&&old===area&&!e.forms.inspector?.compact)e.forms.refresh(true);
  if(area==='sheet'&&e.forms.pkg&&old!==area)this.selectLayout(this.state.sheetSelection);
  if(mode==='visual'&&e.forms.pkg)this.arrangeForms(e.forms.pkg);this.refresh();this.restore();this.measure();if(!initial){e.scheduleDraft();if(old!==this.state.area){const focus=this.state.area==='sheet'?this.panelNav.querySelector('[aria-pressed=true]'):this.state.area==='code'?e.area:this.root.querySelector(`.workspace-${this.state.area} h2`);focus?.focus({preventScroll:true});}}
 }
 syncMode(mode){if(this.navigating)return;const area=mode==='visual'?'sheet':mode==='experiment'?'test':'code';if(this.state.area==='sheet'&&area!=='sheet'){this.state.sheetSelection=[...(this.editor.forms.selection||[])];this.rememberSheet();}if(area==='code')this.state.technicalMode=mode;this.state.area=area;this.refresh();}
 rememberSheet(){const e=this.editor,path=e.forms.selection,pkg=e.forms.pkg;if(path?.[0]==='layouts'&&pkg?.layouts[path[1]])this.layoutSelections.set(pkg.layouts[path[1]].id,{path:[...path],revision:e.session.revision});}
 selectLayout(saved){
  const e=this.editor,pkg=e.forms.pkg;if(!pkg)return;const index=pkg.layouts.findIndex(l=>l.id===e.layout.value),nodes=structuralNodes(pkg).filter(n=>n.path[0]==='layouts'&&n.path[1]===index),stored=this.layoutSelections.get(e.layout.value);
  const rootSaved=Array.isArray(saved)&&structuralNodes(pkg).find(n=>['system','package'].includes(n.kind)&&n.pointer===pointerFor(saved)),paths=[saved,stored?.revision===e.session.revision?stored.path:null,e.forms.selection],target=rootSaved||paths.map(path=>path&&nodes.find(n=>n.pointer===pointerFor(path))).find(Boolean)||nodes.find(n=>n.kind==='component')||nodes.find(n=>n.kind==='container')||nodes[0];
  if(target){e.forms.selectPointer(target.pointer);this.state.sheetSelection=[...target.path];e.forms.refresh(true);this.rememberSheet();}
 }
 arrangeForms(pkg,selected){
  const host=this.editor.formsHost;if(!host||!pkg)return;if(!this.scrollRestorePending)this.capture();this.scrollRestorePending=true;
  const direct=cls=>host.querySelector('.'+cls);
  const collect=()=>{const nodes={};for(const cls of ['editor-toolbox','editor-structure','editor-layout-manager','editor-inspector','editor-data-panel','editor-typed-data','editor-structured-authoring','editor-action-authoring','editor-trigger-authoring','editor-typed-effect-authoring','editor-progression-authoring','editor-rule-graph','editor-typed-rules'])nodes[cls]=direct(cls);return nodes;};
  let nodes=collect();if(!nodes['editor-toolbox'])return;
  // Populate lazily only the requested builder. Its state remains in session.ui.
  if(this.state.area==='rules'&&this.state.rulesPanel==='calculations'||this.state.area==='data'&&this.state.dataPanel==='typed')this.openDetails(nodes['editor-typed-data']);
  nodes=collect();const previous=host.querySelectorAll(':scope > .workspace-tools,:scope > .workspace-properties,:scope > .workspace-domain-nav,:scope > .workspace-domain,:scope > .workspace-first-element');for(const wrapper of previous){for(const node of Object.values(nodes))if(node&&wrapper.contains(node))host.append(node);wrapper.remove();}
  const tools=el('aside','','workspace-tools');tools.setAttribute('aria-label','Ferramentas da ficha');tools.dataset.workspaceScroll='tools';const tabs=el('div','','workspace-tool-tabs');for(const [id,name]of [['structure','Estrutura'],['add','Adicionar'],['layouts','Layouts']]){const n=button(name,()=>{this.capture();this.state.tool=id;this.arrangeForms(pkg,selected);this.restore();this.editor.scheduleDraft();});n.setAttribute('aria-pressed',String(this.state.tool===id));tabs.append(n);}tools.append(tabs);
  const classes={structure:'editor-structure',add:'editor-toolbox',layouts:'editor-layout-manager'};for(const cls of Object.values(classes)){const node=nodes[cls];if(node){node.hidden=cls!==classes[this.state.tool];tools.append(node);}}
  if(this.state.tool==='layouts')this.openDetails(nodes['editor-layout-manager']);
  const destination=el('p','','workspace-destination');const selection=selected||structuralNodes(pkg).find(n=>n.pointer===pointerFor(this.editor.forms.selection||[]));destination.textContent='Destino: '+(selection?this.selectionPath(pkg,selection.path):'Selecione um grupo ou componente');tools.append(destination);
  const props=el('aside','','workspace-properties');props.setAttribute('aria-label','Propriedades da seleção');props.dataset.workspaceScroll='properties';if(nodes['editor-inspector'])props.append(nodes['editor-inspector']);
  const domainNav=el('aside','','workspace-domain-nav');domainNav.dataset.workspaceScroll='families';domainNav.setAttribute('aria-label',this.state.area==='rules'?'Famílias de regras':'Famílias de dados');domainNav.append(el('h2',this.state.area==='rules'?'Regras':'Dados'));
  const domain=el('section','','workspace-domain');domain.dataset.workspaceScroll='domain';const families=DOMAIN_PANELS[this.state.area]||DOMAIN_PANELS.data,key=this.state.area==='rules'?'rulesPanel':'dataPanel',active=families.find(([id])=>id===this.state[key])||families[0];
  for(const [id,name,cls]of families){const n=button(name,()=>{this.capture();this.state[key]=id;this.state.panel='properties';this.arrangeForms(pkg,selected);this.applyPanels();this.editor.scheduleDraft();});n.dataset.workspaceFamily=id;n.setAttribute('aria-pressed',String(id===active[0]));domainNav.append(n);}
  const back=button('Voltar às famílias',()=>{this.state.panel='tools';this.applyPanels();},'back');back.classList.add('workspace-domain-back');domain.append(back);
  for(const cls of ['editor-typed-data','editor-structured-authoring','editor-data-panel','editor-action-authoring','editor-trigger-authoring','editor-typed-effect-authoring','editor-progression-authoring','editor-rule-graph','editor-typed-rules']){const node=nodes[cls];if(node){node.hidden=cls!==active[2];domain.append(node);}}
  if(this.state.area==='rules'&&active[0]==='calculations'&&!nodes['editor-typed-rules']){
   const empty=el('section','','workspace-domain-empty');empty.append(el('h2','Cálculos e consultas'),el('p','Este pacote usa fórmulas do formato anterior. Para criar cálculos visuais, habilite dados tipados em Dados; a mudança exige revisão e confirmação.','editor-note'),button('Configurar dados tipados',()=>{this.state.dataPanel='typed';this.goto('data');},'table','button button--primary'),el('p','As fórmulas existentes continuam disponíveis em Regras e propriedades completas.','editor-note'));domain.append(empty);
  }
  if(['properties','legacy'].includes(active[0])&&['data','rules'].includes(this.state.area)){domain.append(nodes['editor-inspector']);this.selectSystemProperties();}
  else if(['data','rules'].includes(this.state.area))this.openDetails(nodes[active[2]]);
  const index=pkg.layouts.findIndex(l=>l.id===this.editor.layout.value),empty=!structuralNodes(pkg).some(n=>n.kind==='component'&&n.path[1]===index);if(!empty)this.state.firstElement=false;
  if(this.state.area==='sheet'&&this.state.firstElement&&empty){const first=el('section','','workspace-first-element');first.dataset.workspaceScroll='first';first.append(el('h2','Adicione o primeiro elemento'),el('p','1. Escolha o tipo. 2. Dê um nome. 3. Revise a inclusão e confirme.','editor-note'),button('Voltar à ficha vazia',()=>{this.state.firstElement=false;this.editor.forms.refresh(true);this.editor.scheduleDraft();},'back'));
   const box=nodes['editor-toolbox'];first.append(box);const config=box.querySelector('.editor-toolbox-configure');if(config)config.open=true;for(const label of ['Onde colocar','Como configurar']){const select=box.querySelector('select[aria-label="'+label+'"]');if(select?.options.length===1)select.closest('label').hidden=true;}for(const b of box.querySelectorAll('.editor-toolbox-form>button')){b.classList.remove('button--ghost');b.classList.add('button--primary');}host.append(first);
  }
  host.append(tools,props,domainNav,domain);this.formsLayout={tools,props,domainNav,domain,nodes};
  const inspector=nodes['editor-inspector'];if(inspector&&this.state.area==='sheet'){
   const actions=inspector.querySelector('.editor-structure-actions');if(actions&&!actions.closest('details')){const menu=details('Ações do elemento','workspace-element-actions');actions.before(menu);menu.append(actions);}
   const show=button('Mostrar na ficha',()=>this.editor.run(async()=>{this.state.panel='canvas';this.applyPanels();await this.editor.showSourceInPreview();}),'search');inspector.querySelector('.workspace-reveal')?.remove();show.classList.add('workspace-reveal');inspector.prepend(show);
   // Inspector owns progressive groups and automatically reveals pending fields.
  }
  this.applyPanels();this.restore();
 }
 openDetails(node){if(node?.tagName==='DETAILS'&&!node.open){node.open=true;node.dispatchEvent(new Event('toggle'));}}
 selectSystemProperties(){
  const view=this.editor.forms;view.inspector.compact=false;if(view.selection?.[0]!=='system'){view.selectPointer('/system');const node=structuralNodes(view.pkg).find(n=>n.kind==='system');view.inspector.render(view.pkg,node,nodeSchema('system'));}
 }
 selectionPath(pkg,path){return structuralNodes(pkg).filter(n=>n.path.length<=path.length&&n.path.every((part,i)=>path[i]===part)).map(n=>n.title).filter(n=>!['Pacote','Sistema'].includes(n)).join(' › ')||'Sistema';}
 locatePending(pointer,pending){
  if(pointer.startsWith('/draft/')){const map={action:['rules','rulesPanel','actions'],trigger:['rules','rulesPanel','events'],typedEffect:['rules','rulesPanel','effects'],progression:['rules','rulesPanel','progression'],typedRule:['rules','rulesPanel','calculations']};const route=map[pending.builder]|| (pointer.includes('structured')?['data','dataPanel','structured']:pointer.includes('typed-data')?['data','dataPanel','typed']:pointer.includes('composition')?['sheet','tool','add']:['code','technicalMode','forms']);this.state[route[1]]=route[2];this.state.panel=route[0]==='sheet'?'tools':'properties';this.goto(route[0]);const target=this.root.querySelector('.workspace-domain:not([hidden]) input,.workspace-tools:not([hidden]) input');target?.focus();return;}
  this.locateProperty(pointer);
 }
 locateProperty(pointer){
  Object.assign(this.state,diagnosticDestination(pointer));this.goto(this.state.area);if(this.state.area==='code'){this.editor.openFormJson(pointer.split('/').slice(1));return;}
  try{const path=pointer.split('/').slice(1).map(part=>part.replaceAll('~1','/').replaceAll('~0','~'));const view=this.editor.forms;view.selectPointer(pointer);for(let i=1;i<path.length;i++){this.editor.session.ui.formOpen??={};this.editor.session.ui.formOpen[pointerFor(path.slice(0,i))]=true;}view.refresh(true);const row=view.host.querySelector('[data-property="'+CSS.escape(pointer)+'"]');for(let n=row?.parentElement;n&&n!==view.host;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;const target=row?.querySelector('input:not([hidden]),textarea:not([hidden])')||row?.querySelector('select')||row;target?.focus();row?.scrollIntoView({block:'nearest'});}catch{this.goto('code');}
 }
 applyPanels(){
  this.root.dataset.firstElement=String(Boolean(this.state.firstElement));this.root.dataset.workspaceArea=this.state.area;this.root.dataset.workspacePanel=this.state.panel;this.root.dataset.workspaceTool=this.state.tool;for(const n of this.panelButtons)n.setAttribute('aria-pressed',String(n.dataset.workspacePanel===this.state.panel));
  const f=this.formsLayout,domain=['data','rules'].includes(this.state.area);if(f){f.tools.hidden=this.state.area!=='sheet';f.props.hidden=this.state.area!=='sheet';f.domainNav.hidden=!domain;f.domain.hidden=!domain;}
 }
 refresh(){
  const e=this.editor;if(!e.session)return;if(!this.scrollRestorePending&&this.root.dataset.workspaceArea===this.state.area)this.capture();this.name.textContent=e.session.lastValid?.package.system.name||'Rascunho do sistema';this.areaSelect.value=this.state.area;
  for(const [id,n]of this.areaButtons)n.setAttribute('aria-current',id===this.state.area?'page':'false');this.applyPanels();
  this.primary.replaceChildren(document.createTextNode(this.state.area==='review'?'Aplicar sistema…':this.state.area==='sheet'&&this.root.querySelector('.workspace-first-element')?'Revisar inclusão':'Revisar'));glyph(this.primary,'checklist');this.primary.disabled=this.state.area==='review'&&e.apply.disabled;
  this.blockReason.textContent=e.apply.disabled?(Object.keys(e.session.ui.formPending||{}).length?'Aplique ou descarte os campos pendentes antes de aplicar o sistema.':!e.lastRenderedCurrent?'Atualize o ensaio da revisão e do layout atuais antes de aplicar.':e.migration.enabled&&!e.migration.currentReady?'Revise a migração e resolva seus conflitos antes de confirmar.':'Aplicação indisponível nesta revisão.'):'Aplicar abre a revisão de impacto na biblioteca local.';
  const count=Object.keys(e.session.ui.formPending||{}).length;if(count&&this.state.area==='review')e.pendingList.open=true;this.pendingLink.textContent=count?count+' campo(s) pendente(s)':'Ver revisão';this.footerPreview.textContent=e.previewStatus.textContent;
  this.overview.hidden=this.state.area!=='overview';this.review.hidden=this.state.area!=='review';this.body.hidden=!['sheet','data','rules','test','code'].includes(this.state.area);this.panelNav.hidden=!['sheet','data','rules'].includes(this.state.area);
  this.systemName.value=e.session.ui.formPending?.['/system/name']?.raw??e.session.validation.value?.system?.name??'';
  const pkg=e.session.lastValid?.package;this.overviewCounts.replaceChildren();for(const [label,value]of [['Layouts',pkg?.layouts?.length||0],['Dados',pkg?.system.dataDefinitions?.length||0],['Cálculos',pkg?.system.rules?.length||0]]){const n=el('div');n.append(el('strong',String(value)),el('span',label));this.overviewCounts.append(n);}
  this.previewTitle.textContent=this.state.area==='test'?'Experimente seu sistema':'Ficha';this.testIntro.hidden=this.state.area!=='test';this.previewHint.hidden=this.state.area!=='test';if(this.updateButton)this.updateButton.classList.toggle('button--primary',this.state.area==='test');
  const index=pkg?.layouts.findIndex(l=>l.id===e.layout.value),empty=this.state.area==='sheet'&&pkg&&!structuralNodes(pkg).some(n=>n.kind==='component'&&n.path[0]==='layouts'&&n.path[1]===index);this.emptySheet.hidden=!empty;e.frameWrap.hidden=Boolean(empty);
  this.interactions?.refresh();this.restore();this.measure();
 }
 measure(){const viewport=window.visualViewport,cssWidth=parseFloat(getComputedStyle(this.root).width),scale=cssWidth>0?this.root.getBoundingClientRect().width/cssWidth:1;this.root.style.setProperty('--workspace-height',((viewport?.height||window.innerHeight)/(scale||1))+'px');this.root.dataset.lowHeight=String((viewport?.height||innerHeight)<600);if(this.editor.gestures?.active)this.editor.run(()=>this.editor.gestures.canvas(),{background:true});}
 destroy(){this.interactions?.destroy();this.editor.layout.removeEventListener('change',this.onLayout);this.observer?.disconnect();window.visualViewport?.removeEventListener('resize',this.resize);window.removeEventListener('resize',this.resize);this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('keydown',this.onKey);this.root.removeEventListener('scroll',this.onScroll,true);document.body.classList.remove('editor-workspace-open');this.root.classList.remove('editor-workspace');this.root.style.removeProperty('--workspace-height');this.editor.forms.beforeRender=null;this.editor.forms.afterRender=null;}
}
