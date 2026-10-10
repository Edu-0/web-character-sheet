import {CompositionGestures} from './composition-gestures.js';
import {FormView} from './form-view.js';
import {editableDocument,editableVisualDocument} from './form-structure.js';
import {EditorSession} from './session.js';
import {PreviewHost} from './preview-host.js';
import {minimalPackage} from './minimal-package.js';
import {locateDiagnostic} from './source-map.js';
import {previewSources,sourceAtOffset,textareaOffset,sourceOffset} from './source-navigation.js';
import {downloadJson,downloadText} from '../storage.js';
import {confirmDialog,openModal} from '../modal.js';
import {saveDraft,readDraft,decodeDraft} from './draft-repository.js';
import {knownReferences,identityImpact} from './references.js';
import {pointerPath} from './form-commands.js';
import {pointerFor} from './source-map.js';
import {valueAt} from './form-structure.js';
import {renderExperimentReport} from './experiment-report.js';
import {renderReadiness} from './package-readiness.js';
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};

export class JsonEditor {
  constructor(host,{onExit,onApply}={}) {
    this.host=host;this.onExit=onExit;this.onApply=onApply;this.disposed=true;
  }
  async open({text=JSON.stringify(minimalPackage(),null,2),source,draft,draftRaw,returnView='systems'}={}) {
    this.dispose();this.disposed=false;this.exiting=false;this.returnView=returnView;this.session=new EditorSession(draft || {text,source});this.savedRaw=draftRaw!==undefined?draftRaw:draft?readDraft(draft.draftId):null;this.draftConflict=false;this.savePromise=Promise.resolve();this.render();
    if(draft && this.savedRaw!==null)this.session.lastSavedRevision=draft.revision;
    this.refresh();if(this.session.ui.mode==='forms')this.formsHost.querySelector('[tabindex="0"]')?.focus();else this.area.focus();this.area.setSelectionRange(this.session.ui.cursorStart || 0,this.session.ui.cursorEnd || 0);this.area.scrollTop=this.session.ui.scrollTop || 0;this.savedUi=JSON.stringify(this.currentUi());if(this.savedRaw===null)this.scheduleDraft();else this.status.textContent=`Rascunho recuperado · revisão ${this.session.revision}. Histórico JSON reiniciado.`;
    // A montagem pode terminar depois de uma edição, save, saída ou nova sessão.
    // Toda inicialização de UI acontece antes dessa espera.
    if(this.session.validation.status==='ready')await this.run(()=>this.updatePreview());
  }
  render() {
    const root=this.host;root.replaceChildren();root.classList.add('json-editor');
    const header=el('header','','editor-header');header.append(el('h1','Editor de pacotes'));
    this.title=el('p');header.append(this.title);
    const controls=el('div','','editor-actions');
    const action=(label,fn)=>{const button=el('button',label,'button button--ghost');button.type='button';button.addEventListener('click',()=>this.run(fn));controls.append(button);return button;};
    this.undo=action('Desfazer JSON',()=>{this.session.replay('undo');this.changed(true);});
    this.redo=action('Refazer JSON',()=>{this.session.replay('redo');this.changed(true);});
    action('Validar JSON',()=>{this.session.validate();this.refresh();});
    this.format=action('Formatar JSON',()=>{const result=this.session.validate();if(!result.value || result.diagnostics.some(issue=>issue.code?.startsWith('json.')))throw new Error('Corrija sintaxe/duplicatas/números antes de formatar.');this.session.replaceText(JSON.stringify(result.value,null,2),{label:'Formatar JSON'});this.changed(true);});
    this.normalize=action('Normalizar aliases',async()=>{const revision=this.session.revision,result=this.session.validate();if(!result.migrationPlan)throw new Error('Não há normalização disponível.');if(await confirmDialog(result.migrationPlan.changes.join('\n'),{title:'Normalização explícita',confirmLabel:'Normalizar JSON'})){this.session.normalizationOriginal=result.migrationPlan.original;this.session.normalize(revision);this.changed(true);}});
    this.restore=action('Restaurar última válida',()=>{this.session.restoreValid();this.changed(true);});
    this.original=action('Baixar original da normalização',()=>downloadText(this.session.recoveryOriginalText,'antes-normalizacao.json'));
    this.save=action('Salvar rascunho',()=>this.saveDraft());
    action('Salvar rascunho como cópia',()=>this.saveDraft(true));
    action('Baixar rascunho',()=>downloadJson(this.session.envelope(),'rascunho-rpg.json'));
    this.export=action('Exportar pacote',()=>this.exportPackage());
    this.exportValid=action('Exportar última versão válida',()=>this.exportPackage(true));
    this.apply=action('Aplicar pacote',()=>this.applyPackage());
    action('Sair do editor',()=>this.exit());
    header.append(controls);root.append(header);
    const modes=el('div','','editor-mode-controls');modes.setAttribute('role','group');modes.setAttribute('aria-label','Modo de edição');
    for(const [mode,label]of [['json','Editar JSON'],['forms','Editar por formulários'],['visual','Compor'],['experiment','Experimentar']]){const button=el('button',label,'button button--ghost');button.type='button';button.dataset.mode=mode;button.addEventListener('click',()=>this.run(()=>this.setMode(mode)));modes.append(button);}root.append(modes);this.modes=modes;this.pendingList=el('details','','editor-pending-list');this.pendingList.append(el('summary','Texto pendente dos formulários'));this.pendingEntries=el('div');this.pendingList.append(this.pendingEntries);root.append(this.pendingList);
    root.append(el('p','Rascunhos ficam nesta origem do navegador e não entram em Exportar tudo. Baixe seu rascunho. JSON e formulários compartilham o histórico do editor, que dura somente nesta sessão.','editor-note'));
    this.status=el('p');this.status.id='editor-status';this.status.setAttribute('role','status');root.append(this.status);
    this.applicationStatus=el('p');this.applicationStatus.id='editor-application-status';this.applicationStatus.setAttribute('role','status');root.append(this.applicationStatus);
    const tabs=el('div','','editor-mobile-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Painéis do editor');
    for(const [value,label] of [['json','JSON'],['diagnostics','Diagnósticos'],['preview','Prévia']]) {const button=el('button',label,'button button--ghost');button.type='button';button.dataset.panel=value;button.addEventListener('click',()=>{this.session.ui.panel=value;this.panel(value);this.scheduleDraft();});tabs.append(button);}root.append(tabs);this.tabs=tabs;
    const split=el('label','Divisão JSON / prévia','editor-split');const range=el('input');this.split=range;range.type='range';range.min=30;range.max=70;range.value=this.session.ui.split || 50;root.style.setProperty('--editor-split',`${range.value}%`);range.setAttribute('aria-label','Largura do painel JSON');range.addEventListener('input',()=>{this.session.ui.split=Number(range.value);root.style.setProperty('--editor-split',`${range.value}%`);this.scheduleDraft();});split.append(range);root.append(split);
    const body=el('div','','editor-body'),left=el('section','','editor-source');left.dataset.editorPanel='json';
    const label=el('label','Texto JSON do pacote');label.htmlFor='editor-json';this.area=el('textarea');this.area.id='editor-json';this.area.spellcheck=false;this.area.autocapitalize='off';this.area.setAttribute('aria-describedby','editor-validation-summary');
    this.area.addEventListener('input',event=>{this.session.replaceText(this.area.value,{group:event.inputType?.includes('Paste')?null:'json',label:'Editar JSON'});this.changed();});
    this.area.addEventListener('focusout',()=>{this.session.history.breakGroup();this.scheduleDraft();});
    this.area.addEventListener('select',()=>this.scheduleDraft());this.area.addEventListener('scroll',()=>this.scheduleDraft());
    this.area.addEventListener('compositionstart',()=>{this.composing=true;clearTimeout(this.validationTimer);});
    this.area.addEventListener('compositionend',()=>{this.composing=false;this.changed();});
    this.area.addEventListener('keydown',event=>{
      if(event.isComposing || this.composing)return;
      if(event.altKey && event.key==='Enter'){event.preventDefault();event.stopPropagation();this.run(()=>this.showSourceInPreview());return;}
      if(event.altKey || !(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();event.stopPropagation();this.session.replay(key==='y'||event.shiftKey?'redo':'undo');this.changed(true);}if(key==='s'){event.preventDefault();this.run(()=>this.saveDraft());}
    });
    this.showPreview=el('button','Mostrar na prévia','button button--ghost');this.showPreview.type='button';this.showPreview.setAttribute('aria-keyshortcuts','Alt+Enter');this.showPreview.addEventListener('click',()=>this.run(()=>this.showSourceInPreview()));
    this.sourceLabel=label;left.append(label,this.showPreview,this.area);
    this.formsHost=el('div','','editor-forms');left.append(this.formsHost);
    this.forms=new FormView(this.formsHost,{session:this.session,onChange:()=>{this.formsText=this.session.text;this.changed(true);},onPending:(rerender,message)=>{if(rerender)this.refresh();else this.refreshPending();if(message)this.status.textContent=message;this.scheduleDraft();},onJson:path=>this.openFormJson(path),confirm:(message,options={})=>confirmDialog(message,{title:'Revisar alteração',confirmLabel:'Confirmar alteração',messageClass:'system-removal-review',...options})});
    this.formsHost.addEventListener('keydown',event=>{
      if(event.isComposing || event.altKey || !(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();
      if(key==='s'){event.preventDefault();event.stopPropagation();this.run(()=>this.saveDraft());return;}
      if(['z','y'].includes(key) && !event.target.closest('input,textarea,select,[contenteditable]')){event.preventDefault();event.stopPropagation();this.session.replay(key==='y'||event.shiftKey?'redo':'undo');this.changed(true);}
    });
    body.append(left);
    this.previewSection=el('section','','editor-preview');this.previewSection.dataset.editorPanel='preview';
    this.previewSection.append(el('h2','Prévia'),el('p','Ensaio — não altera seus personagens. A amostra vem do template e suas edições são efêmeras.','editor-note'));
    const tools=el('div','','editor-preview-tools');
    const select=(label,options)=>{const wrap=el('label',label),input=el('select');for(const [value,text]of options){const option=el('option',text);option.value=value;input.append(option);}wrap.append(input);tools.append(wrap);return input;};
    this.layout=select('Layout de ensaio',[]);this.layout.addEventListener('change',()=>{this.session.ui.layoutId=this.layout.value;this.refresh();this.scheduleDraft();this.queueCompositionPreview();});
    this.theme=select('Tema do ensaio',[['light','Claro'],['dark','Escuro']]);this.theme.value=this.session.ui.theme || document.documentElement.dataset.theme || 'dark';
    this.theme.addEventListener('change',()=>{this.session.ui.theme=this.theme.value;this.preview.appearance({theme:this.theme.value,palette:document.documentElement.dataset.palette || 'classic'});this.scheduleDraft();});
    this.width=select('Largura do ensaio',[['auto','Automática'],['360','360 px'],['768','768 px'],['1280','1280 px']]);this.width.value=this.session.ui.width || 'auto';this.width.addEventListener('change',()=>{this.gestures?.cancel();this.session.ui.width=this.width.value;this.frameWrap.style.setProperty('--preview-width',this.width.value==='auto'?'100%':`${this.width.value}px`);this.scheduleDraft();});
    const update=el('button','Atualizar / reiniciar ensaio','button button--primary');update.type='button';update.addEventListener('click',()=>this.run(()=>this.updatePreview()));tools.append(update);
    this.reportButton=el('button','Conferir leituras e resultados','button button--ghost');this.reportButton.type='button';this.reportButton.addEventListener('click',()=>this.run(async()=>{if(this.session.ui.mode!=='experiment')throw new Error('Abra Experimentar para conferir a amostra.');if(!this.navigationReady())return;const context=this.lastRendered,snapshot=await this.preview.snapshot();if(context!==this.lastRendered||!this.navigationReady()||this.session.ui.mode!=='experiment')throw new Error('O ensaio mudou. Confira a amostra atual novamente.');renderExperimentReport(this.experimentReport,this.session.lastValid.package,snapshot);this.experimentReport.hidden=false;this.experimentReport.scrollIntoView({block:'nearest'});}));tools.append(this.reportButton);
    this.locating=false;this.locate=el('button','Localizar no JSON','button button--ghost');this.locate.classList.add('editor-locate');this.locate.type='button';this.locate.setAttribute('aria-pressed','false');this.locate.addEventListener('click',()=>this.setLocating(!this.locating));tools.append(this.locate);
    const navigationHelp=el('p','Localizar no JSON: ative e clique/toque em texto, campo ou botão para selecionar seu bloco completo, sem executar ações. Tab e Enter também localizam; Escape desativa. Da árvore, use Mostrar na prévia; do JSON, também Alt+Enter.','editor-note');navigationHelp.id='editor-navigation-help';
    this.locate.setAttribute('aria-describedby',navigationHelp.id);this.showPreview.setAttribute('aria-describedby',navigationHelp.id);
    this.navigationStatus=el('p');this.navigationStatus.id='editor-navigation-status';this.navigationStatus.setAttribute('role','status');
    this.previewStatus=el('p');this.previewStatus.id='editor-preview-status';this.previewStatus.setAttribute('role','status');this.frameWrap=el('div','','editor-frame-wrap');
    this.previewSection.append(tools,navigationHelp,this.previewStatus,this.frameWrap);body.append(this.previewSection);root.append(this.navigationStatus,body);
    this.experimentReport=el('section','','editor-experiment-report');this.experimentReport.hidden=true;this.previewSection.append(this.experimentReport);
    this.diagnostics=el('section','','editor-diagnostics');this.diagnostics.dataset.editorPanel='diagnostics';this.diagnostics.append(el('h2','Diagnósticos'));
    this.readiness=el('details','','editor-package-readiness');this.readiness.append(el('summary','Conferir e fechar pacote'));this.readinessBody=el('div');this.readiness.append(this.readinessBody);root.append(this.readiness);
    this.summary=el('p');this.summary.id='editor-validation-summary';this.summary.setAttribute('role','status');this.issues=el('ul');this.diagnostics.append(this.summary,this.issues);root.append(this.diagnostics);
    this.frameWrap.style.setProperty('--preview-width',this.width.value==='auto'?'100%':`${this.width.value}px`);
    this.preview=new PreviewHost(this.frameWrap,{sessionId:this.session.draftId,onDiagnostic:message=>{this.runtimeError=message;this.refresh();},onSource:message=>this.pickSource(message),onInspectionEnd:()=>this.setLocating(false),onCompositionDrop:message=>{if(this.session.ui.mode==='visual'&&this.navigationReady()&&['sessionId','generation','revision','layoutId'].every(k=>message[k]===this.lastRendered[k]))this.gestures?.fromCanvas(message);}});
    this.gestures=new CompositionGestures(this);this.forms.onVisualRender=pkg=>this.gestures.attach(pkg);
    this.area.value=this.session.text;this.panel(this.session.ui.panel || 'json');this.setMode(this.session.ui.mode || 'json',true);
  }
  setMode(mode,initial=false) {
    if(['forms','visual'].includes(mode))try{(mode==='visual'?editableVisualDocument:editableDocument)(this.session);}catch(error){if(!initial)throw error;mode='json';}
    this.gestures?.cancel();const previousMode=this.session.ui.mode;this.session.ui.mode=mode;this.area.hidden=mode!=='json';this.sourceLabel.hidden=mode!=='json';this.formsHost.hidden=!['forms','visual'].includes(mode);this.forms.visual=mode==='visual';this.host.dataset.authoringMode=mode;if((previousMode==='visual')!==(mode==='visual'))this.preview?.compose(mode==='visual');if(mode==='experiment'&&this.locating)this.setLocating(false);
    for(const button of this.modes.children)button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
    const editTab=this.tabs.querySelector('[data-panel="json"]');editTab.textContent=mode==='visual'?'Composição':mode==='forms'?'Propriedades':'JSON';editTab.hidden=mode==='experiment';this.reportButton.hidden=mode!=='experiment';if(mode!=='experiment')this.experimentReport.hidden=true;if(mode==='experiment'){this.session.ui.panel='preview';this.panel('preview');}
    if(['forms','visual'].includes(mode)){this.forms.refresh();this.formsText=this.session.text;}this.refreshPending();if(!initial){this.scheduleDraft();this.queueCompositionPreview();}
  }
  refreshPending(){const entries=Object.entries(this.session.ui.formPending || {}),count=entries.length;if(this.pendingList){this.pendingList.hidden=!count;this.pendingEntries.replaceChildren();for(const [pointer,pending]of entries){const row=el('div','','editor-pending-entry');row.append(el('code',pointer),el('p',String(pending?.raw ?? '')+' · '+String(pending?.mode ?? '')));const discard=el('button','Descartar pendência','button button--ghost');discard.type='button';discard.addEventListener('click',()=>{delete this.session.ui.formPending[pointer];for(const key of ['formulaDrafts','diceDrafts','conditionDrafts','rollSourceDrafts','costDrafts'])delete this.session.ui[key]?.[pointer];this.refresh();this.forms.refresh(true);this.scheduleDraft();});row.append(discard);this.pendingEntries.append(row);}}this.host.dataset.formPending=String(count);if(this.readinessBody)renderReadiness(this.readinessBody,this);if(count)this.status.textContent=count+' campo(s) com texto pendente nos formulários; aplique ou descarte cada campo. O rascunho preserva esse texto.';if(this.apply && count)this.apply.disabled=true;if(this.export && count)this.export.disabled=true;}
  assertNoPending(){if(Object.keys(this.session.ui.formPending || {}).length)throw new Error('Há texto pendente nos formulários. Aplique ou descarte os campos antes de exportar/aplicar.');}
  openFormJson(path){this.setMode('json');const range=this.session.validation.locations.get('/'+path.map(key=>String(key).replaceAll('~','~0').replaceAll('/','~1')).join('/'));if(range)this.selectJsonRange(range);else{this.panel('json');this.area.focus();}}
  openDiagnostic(issue,result){
    if(['visual','forms'].includes(this.session.ui.mode)&&issue.pointer)try{
      const path=pointerPath(result.value,issue.pointer),node=this.forms.selectPointer(issue.pointer);if(node){this.session.ui.formOpen??={};for(let i=node.path.length+1;i<=path.length;i++)this.session.ui.formOpen[pointerFor(path.slice(0,i))]=true;let branch=path.slice(0,-1);while(branch.length>node.path.length&&valueAt(result.value,branch)===undefined)branch.pop();if(branch.length-node.path.length>10)this.session.ui.inspectorBranch=branch;this.forms.refresh(true);this.session.ui.panel='json';this.panel('json');const property=this.formsHost.querySelector('[data-property="'+CSS.escape(issue.pointer)+'"]');if(property){property.tabIndex=-1;property.focus();property.scrollIntoView({block:'nearest'});}this.navigationStatus.textContent='Corrigir neste bloco: '+issue.message+'. O documento permanece preservado até aplicar a correção.';this.scheduleDraft();return;}
    }catch{}
    const range=issue.location||locateDiagnostic(this.session.text,result.locations,issue);if(range)this.selectJsonRange(range);else{this.setMode('json');this.panel('json');this.area.focus();}
  }
  panel(value) {this.host.dataset.editorPanel=value;for(const button of this.tabs.children)button.setAttribute('aria-pressed',String(button.dataset.panel===value));}
  setLocating(enabled) {
    this.locating=enabled===true && this.lastRenderedCurrent;
    this.locate.setAttribute('aria-pressed',String(this.locating));this.preview.inspect(this.locating||this.session.ui.mode==='visual');
    this.navigationStatus.textContent=this.locating?'Localizar ativo: clique/toque ou use Enter no elemento. As ações da prévia estão suspensas.':this.session.ui.mode==='visual'?'Compor: selecione a definição original. Ações de jogo estão suspensas.':'Localizar desativado: a prévia está interativa.';
  }
  navigationReady() {
    if(this.disposed || !this.lastRenderedCurrent || this.lastRendered?.revision!==this.session.revision || this.lastRendered?.layoutId!==this.layout.value) {
      this.navigationStatus.textContent='Atualize o ensaio da revisão e do layout atuais antes de navegar entre JSON e prévia.';return false;
    }
    return true;
  }
  pickSource(message) {
    if(!this.navigationReady() || ['sessionId','generation','revision','layoutId'].some(key=>message[key]!==this.lastRendered[key]))return;
    const range=this.session.validation.locations.get(message.pointer);if(!range)return;
    this.forms.selectPointer(message.pointer);
    if(this.session.ui.mode==='visual'){this.forms.refresh(true);this.session.ui.panel='json';this.panel('json');this.navigationStatus.textContent='Definição selecionada: '+(this.forms.pkg&&this.forms.selection?valueAt(this.forms.pkg,this.forms.selection)?.label||valueAt(this.forms.pkg,this.forms.selection)?.title||'bloco da ficha':'bloco da ficha')+'. Em repetição, a alteração vale para todas as ocorrências. Compor não joga.';this.scheduleDraft();return;}
    const line=this.selectJsonRange(range);
    this.navigationStatus.textContent=`Bloco selecionado no JSON: ${message.pointer} · linha ${line}. O texto não foi alterado.`;this.scheduleDraft();
  }
  selectJsonRange(range) {
    this.setMode('json');
    const start=textareaOffset(this.session.text,range.start),end=textareaOffset(this.session.text,range.end),display=this.area.value;
    let line=1;for(let i=0;i<start;i++)if(display[i]==='\n')line++;
    this.session.ui.panel='json';this.panel('json');this.area.focus();this.area.setSelectionRange(start,end);
    this.area.scrollTop=Math.max(0,(line-1)*parseFloat(getComputedStyle(this.area).lineHeight)-this.area.clientHeight/3);this.area.scrollLeft=0;this.area.scrollIntoView({block:'nearest'});
    return line;
  }
  async showSourceInPreview() {
    if(!this.navigationReady())return;
    const session=this.session,context=this.lastRendered;
    const sources=previewSources(session.lastValid.package,context.layoutId);
    const selection=this.forms.selection,formPointer=selection?'/'+selection.map(part=>String(part).replaceAll('~','~0').replaceAll('/','~1')).join('/'):null;
    const pointer=['forms','visual'].includes(session.ui.mode)?(sources.has(formPointer)?formPointer:formPointer==='/system' && sources.has('/system/name')?'/system/name':null):sourceAtOffset(session.validation.locations,sources,sourceOffset(session.text,this.area.selectionStart));
    if(!pointer){this.navigationStatus.textContent='Este trecho não tem elemento direto no layout de ensaio. Posicione o cursor em um componente, seção, aba, layout ou cabeçalho visível.';return;}
    // Reveal the mobile panel before the frame computes geometry and scrolls.
    const previousPanel=this.host.dataset.editorPanel;this.panel('preview');
    let result;
    try{result=await this.preview.revealSource(pointer);}
    catch(error){if(!this.disposed && session===this.session && context===this.lastRendered)this.panel(previousPanel);throw error;}
    if(this.disposed || session!==this.session || context!==this.lastRendered || !this.navigationReady())return;
    if(!result.found){this.panel(previousPanel);this.navigationStatus.textContent='Este bloco não gerou elemento na prévia atual (por exemplo, repetição sem entradas).';return;}
    this.session.ui.panel='preview';this.panel('preview');this.frameWrap.scrollIntoView({block:'nearest'});
    this.navigationStatus.textContent=`Localizado na prévia: ${pointer} · ${result.count} ocorrência(s) destacada(s).`;this.scheduleDraft();
  }
  changed(sync=false) {
    this.gestures?.cancel();
    clearTimeout(this.validationTimer);this.lastRenderedCurrent=false;
    this.status.textContent=this.draftConflict?`Revisão ${this.session.revision} em memória; conflito com outra aba. Salve como cópia ou baixe o rascunho.`:`Revisão ${this.session.revision} em memória; salvamento do rascunho pendente.`;
    if(sync){this.area.value=this.session.text;this.session.validate();this.refresh();}
    else {this.refresh(false);if(!this.composing)this.validationTimer=setTimeout(()=>{this.session.validate();this.refresh();},350);}
    this.scheduleDraft?.();if(sync)this.queueCompositionPreview();
  }
  queueCompositionPreview(){clearTimeout(this.compositionPreviewTimer);if(this.session.ui.mode!=='visual'||this.session.validation.status!=='ready'||this.lastRenderedCurrent)return;const session=this.session;this.compositionPreviewTimer=setTimeout(()=>{if(this.disposed||this.session!==session||session.ui.mode!=='visual'||session.validation.status!=='ready'||this.lastRenderedCurrent)return;this.run(()=>this.updatePreview());},100);}
  refresh(validated=true) {
    const session=this.session,result=session.validation;
    this.title.textContent=`${session.lastValid?.package.system.name || 'Rascunho'} · ${session.lastValid?.package.system.id || 'ID ainda inválido'} · origem: ${session.source.kind}${session.source.name?` (${session.source.name})`:''} · revisão ${session.revision} · última válida: ${session.lastValid?.revision ?? 'nenhuma'} · ${session.lastApplied?.revision===session.revision?'Aplicado':'Não aplicado'}`;
    this.undo.disabled=!session.history.undoStack.length;this.redo.disabled=!session.history.redoStack.length;this.restore.disabled=!session.lastValid;
    this.export.disabled=!validated || result.status!=='ready';this.exportValid.disabled=!session.lastValid;
    this.normalize.hidden=result.status!=='needsMigration';
    this.original.hidden=!session.recoveryOriginalText;
    if(!validated){const pending='Validação pendente. O texto atual permanece preservado.';if(this.summary.textContent!==pending)this.summary.textContent=pending;this.issues.replaceChildren();}
    if(validated){
      this.summary.textContent=`${result.status==='ready'?'Contrato válido':result.status==='needsMigration'?'Normalização requer confirmação':result.status==='unsupported'?'Versão não suportada':'JSON inválido'} · ${result.diagnostics.length} diagnóstico(s).`;
      this.issues.replaceChildren();for(const issue of result.diagnostics){const li=el('li'),button=el('button',`${issue.severity}: ${issue.pointer || issue.path || '/'} — ${issue.message}`);button.type='button';
        button.addEventListener('click',()=>this.openDiagnostic(issue,result));li.append(button);this.issues.append(li);}
      const layouts=session.lastValid?.package.layouts || [], selected=session.ui.layoutId || layouts[0]?.id;
      if(result.status==='ready'){
        const impact=identityImpact(session.source.base,result.document), references=knownReferences(result.document);
        this.summary.textContent+=` ${references.length} usos conhecidos de referências; ${impact.changedReferences.length} alterados; layouts removidos: ${impact.removedLayouts.join(', ') || 'nenhum'}. Extensões opacas não são refatoradas.`;
      }
      this.layout.replaceChildren(...layouts.map(layout=>{const option=el('option',layout.name || layout.manifest?.name || layout.id);option.value=layout.id;return option;}));
      this.layout.value=layouts.some(layout=>layout.id===selected)?selected:layouts[0]?.id || '';session.ui.layoutId=this.layout.value;
    }
    this.lastRenderedCurrent=this.lastRendered?.revision===session.revision && this.lastRendered.layoutId===this.layout.value && !this.runtimeError && validated && result.status==='ready';
    if(!this.lastRenderedCurrent)this.experimentReport.hidden=true;
    renderReadiness(this.readinessBody,this);
    this.previewStatus.textContent=this.runtimeError?`Erro de execução: ${this.runtimeError}. Prévia anterior mantida.`:this.lastRenderedCurrent?`Ensaio da revisão ${session.revision} · ${this.layout.value}`:this.lastRendered?`Prévia desatualizada — revisão ${this.lastRendered.revision}. Atualize explicitamente após terminar a interação.`:'Nenhuma prévia válida ainda. Valide o JSON e atualize o ensaio.';
    this.apply.disabled=!this.lastRenderedCurrent;
    this.locate.disabled=!this.lastRenderedCurrent;this.showPreview.disabled=!this.lastRenderedCurrent;
    if(!this.lastRenderedCurrent && this.locating)this.setLocating(false);
    if(validated && ['forms','visual'].includes(this.session.ui.mode) && this.formsText!==session.text){this.forms.refresh();this.formsText=session.text;}
    this.refreshPending();
    if(session.history.boundary)this.status.textContent='Edição preservada; o limite do histórico encerrou operações anteriores.';
  }
  async updatePreview() {
    clearTimeout(this.compositionPreviewTimer);
    const result=this.session.validate();this.refresh();if(result.status!=='ready')throw new Error('Corrija o documento atual antes de atualizar o ensaio.');
    const revision=this.session.revision, layoutId=this.layout.value, session=this.session,request=Symbol();this.previewRequest=request;
    this.runtimeError=null;this.previewStatus.textContent='Montando ensaio…';
    this.setLocating(false);this.lastRenderedCurrent=false;this.locate.disabled=true;this.showPreview.disabled=true;
    try {const context=await this.preview.mount(result.document,{revision,layoutId,appearance:{theme:this.theme.value,palette:document.documentElement.dataset.palette || 'classic'}});if(this.disposed||session!==this.session||request!==this.previewRequest)return;this.runtimeError=null;this.preview.appearance({theme:this.theme.value,palette:document.documentElement.dataset.palette || 'classic'});this.lastRendered=context;this.preview.compose(this.session.ui.mode==='visual');this.refresh();if(this.session.ui.mode==='visual'){const pointer=pointerFor(this.forms.selection||[]);if(this.preview.current?.sources.has(pointer))await this.preview.revealSource(pointer,{focus:false});}}
    catch(error){if(this.disposed||session!==this.session||request!==this.previewRequest)return;this.runtimeError=error.message;this.refresh();throw error;}
  }
  exportPackage(lastValid=false) {
    if(!lastValid)this.assertNoPending();
    const result=this.session.validate();if(!lastValid && result.status!=='ready')throw new Error('A revisão atual não é válida. Baixe o rascunho ou exporte explicitamente a última válida.');
    const snapshot=lastValid?this.session.lastValid:{package:result.document,revision:this.session.revision};if(!snapshot)throw new Error('Sem versão válida.');
    downloadJson(snapshot.package,`${snapshot.package.system.id}.system.json`);this.status.textContent=`Pacote exportado da revisão ${snapshot.revision}; amostra de ensaio excluída.`;
  }
  async applyPackage() {this.assertNoPending();if(!this.lastRenderedCurrent)throw new Error('Atualize o ensaio da revisão atual antes de aplicar.');if(!this.onApply)throw new Error('Aplicação ainda indisponível.');await this.onApply(this);this.refresh();}
  scheduleDraft() {clearTimeout(this.draftTimer);if(!this.draftConflict && !this.exiting)this.draftTimer=setTimeout(()=>this.run(()=>this.saveDraft()),650);}
  currentUi(){return {...this.session.ui,theme:this.theme.value,width:this.width.value,split:Number(this.split.value),cursorStart:this.area.selectionStart,cursorEnd:this.area.selectionEnd,scrollTop:this.area.scrollTop};}
  saveDraft(copy=false) {
    clearTimeout(this.draftTimer);const session=this.session;
    this.savePromise=this.savePromise.catch(()=>{}).then(async()=>{
      if(this.disposed || session!==this.session)return;
      session.validate();session.ui=this.currentUi();
      if(copy){session.draftId=crypto.randomUUID();this.savedRaw=null;this.draftConflict=false;}
      const envelope=session.envelope();
      try {const raw=await saveDraft(envelope,this.savedRaw);if(this.disposed || session!==this.session)return;this.savedRaw=raw;this.savedUi=JSON.stringify(envelope.ui);session.lastSavedRevision=envelope.revision;this.status.textContent=`Rascunho salvo nesta origem · revisão ${envelope.revision}. Fora de Exportar tudo.`;}
      catch(error){if(this.disposed || session!==this.session)return;this.draftConflict=error.code==='draft-conflict';throw new Error(`${error.message} Texto preservado em memória; use Baixar rascunho.`,{cause:error});}
    });return this.savePromise;
  }
  async exit(view=this.returnView) {
    clearTimeout(this.draftTimer);this.exiting=true;
    await this.savePromise.catch(()=>{});
    if(this.session.lastSavedRevision===this.session.revision && this.savedUi!==JSON.stringify(this.currentUi())){try{await this.saveDraft();}catch{this.session.lastSavedRevision=-1;}}
    if(this.session.lastSavedRevision!==this.session.revision){
      const choice=await new Promise(resolve=>{
        const content=el('p','Há mudanças não salvas no texto ou na apresentação do editor. Escolha como preservar ou descartar as alterações desde o último salvamento.');
        openModal({title:'Sair do editor',contentEl:content,onClose:()=>resolve('continue'),actions:[
          {label:'Continuar editando',onClick:()=>resolve('continue')},{label:'Salvar e sair',onClick:()=>resolve('save')},
          {label:'Baixar e sair',onClick:()=>resolve('download')},{label:'Descartar e sair',onClick:()=>resolve('discard')},
        ]});
      });
      if(choice==='continue'){this.exiting=false;this.scheduleDraft();return false;}
      if(choice==='save'){try{await this.saveDraft();}catch(error){this.exiting=false;throw error;}}
      if(choice==='download')downloadJson(this.session.envelope(),'rascunho-rpg.json');
    }
    this.dispose();this.onExit?.(view);return true;
  }
  async run(fn) {const session=this.session;try {await fn();}catch(error){if(!this.disposed && session===this.session)this.status.textContent=error.message;}}
  dispose() {clearTimeout(this.compositionPreviewTimer);clearTimeout(this.validationTimer);clearTimeout(this.draftTimer);this.gestures?.destroy();this.preview?.dispose();this.lastRendered=null;this.runtimeError=null;this.disposed=true;}
}
