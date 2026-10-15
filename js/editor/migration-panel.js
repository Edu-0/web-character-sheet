import {el,button,choose,input} from './authoring-dom.js';
import {dataDefinitions} from '../engine/data-definitions.js';
import {initializeStructuredValue} from '../engine/data-types.js';
import {systemDataRevision} from '../engine/data-revision.js';
import {dataMigrationImpact} from '../migrations/data-migration-plan.js';
import {DATA_CONVERSIONS} from '../migrations/data-conversions.js';
import {numberFromText,setValueCommands} from './form-commands.js';
import {downloadJson} from '../storage.js';
const names={copy:'Conservar valor',text:'Converter em texto',number:'Converter em número',integer:'Converter em inteiro',boolean:'Converter em Sim/Não',map:'Mapear valores ou identidades',split:'Dividir texto',join:'Juntar textos',initialize:'Inicializar somente ausentes'};
const title=row=>row.ancestors.map(parent=>parent.label).concat(row.definition.label).join(' › ');
const display=cell=>!cell?.present?'Ausente':cell.value===null?'null':String(JSON.stringify(cell.value)).slice(0,600);

export class MigrationPanel{
 constructor(editor){this.editor=editor;this.host=el('details','','editor-migration');this.host.append(el('summary','Migração dos dados instalados'));this.host.addEventListener('toggle',()=>{if(this.host.open)this.draw();});}
 get state(){return this.editor.session.ui.dataMigration??={enabled:false,spec:{version:1,steps:[],retired:[]},raw:{},errors:{}};}
 removeMapping(step){this.clearInputs();this.state.spec.steps=this.state.spec.steps.filter(row=>row!==step);this.state.spec.overrides=this.state.spec.overrides?.filter(row=>row.targetId!==step.targetId)??[];this.invalidate();}
 clearInputs(){this.state.raw={};this.state.errors={};}
 get enabled(){return this.state.enabled===true;}
 get currentReady(){return this.review?.migration?.status==='ready'&&this.reviewRevision===this.editor.session.revision&&this.reviewSpec===JSON.stringify(this.state.spec);}
 invalidate(){this.review=null;this.restoration=null;if(this.status)this.status.textContent='Escolhas alteradas; revise os personagens antes de aplicar.';this.editor.scheduleDraft();this.editor.apply.disabled=this.enabled||!this.editor.lastRenderedCurrent;}
 refresh(){if(this.revision!==this.editor.session.revision||this.base!==this.editor.session.source.base){this.review=null;this.restoration=null;this.revision=this.editor.session.revision;this.base=this.editor.session.source.base;if(this.host.open)this.draw();}}
 async enable(){
  const editor=this.editor,pkg=editor.session.validate().document,base=editor.session.source.base;editor.assertNoPending();if(!base||!pkg||pkg.system.schemaVersion!==3)throw Error('Abra uma cópia instalada e habilite v3 explicitamente antes de preparar migração.');
  const state=this.state;state.enabled=true;this.clearInputs();const revision=systemDataRevision(base.system)+1;state.previousRevision={present:Object.hasOwn(pkg.system,'dataRevision'),value:pkg.system.dataRevision};
  if(pkg.system.dataRevision!==revision){editor.session.operate(setValueCommands(pkg,['system','dataRevision'],revision),{label:'Preparar revisão dos dados instalados'});editor.changed(true);}
  const candidate=editor.session.validate().document,impact=dataMigrationImpact(base,candidate);state.spec={version:1,steps:impact.filter(row=>row.kind==='changed').map(row=>({targetId:row.dataId,sourceIds:[row.dataId],conversion:'copy',options:{},destination:'block',preserveSource:true})),retired:impact.filter(row=>row.kind==='retired').map(row=>({dataId:row.dataId,disposition:'preserve'})),overrides:[]};
  this.invalidate();this.draw();await editor.updatePreview();
 }
 async disable(){
  const editor=this.editor,state=this.state,pkg=editor.session.validate().document,base=editor.session.source.base;
  if(state.previousRevision&&pkg?.system.dataRevision===systemDataRevision(base?.system)+1){const previous=state.previousRevision;editor.session.operate(previous.present?setValueCommands(pkg,['system','dataRevision'],previous.value):[{type:'removeProperty',path:['system','dataRevision']}],{label:'Cancelar preparação da revisão dos dados'});editor.changed(true);}
  state.enabled=false;delete state.previousRevision;this.invalidate();this.draw();
 }
 markApplied(){this.state.enabled=false;delete this.state.previousRevision;this.review=null;this.restoration=null;this.draw();}
 literal(host,label,key,value,onValue){
  const state=this.state;state.raw[key]??={type:value===null?'null':Array.isArray(value)||value&&typeof value==='object'?'json':typeof value==='boolean'?'boolean':typeof value==='number'?'number':'string',text:value===undefined?'':typeof value==='string'?value:JSON.stringify(value)};const pending=state.raw[key];
  const kind=choose('Tipo de '+label,[['string','Texto'],['number','Número'],['boolean','Sim/Não'],['null','null'],['json','Valor estruturado JSON']],pending.type),control=input(label,pending.text),boolean=choose('Sim/Não de '+label,[['false','Não'],['true','Sim']],pending.text);host.append(kind.wrap,control.wrap,boolean.wrap);
  const render=()=>{control.wrap.hidden=['null','boolean'].includes(pending.type);boolean.wrap.hidden=pending.type!=='boolean';};
  const publish=()=>{pending.type=kind.input.value;pending.text=pending.type==='boolean'?boolean.input.value:control.input.value;try{const value=pending.type==='null'?null:pending.type==='number'?numberFromText(pending.text):pending.type==='boolean'?pending.text==='true':pending.type==='json'?JSON.parse(pending.text):pending.text;onValue(value);delete state.errors[key];}catch(error){state.errors[key]=error.message;}render();this.invalidate();};kind.input.addEventListener('change',publish);control.input.addEventListener('input',publish);boolean.input.addEventListener('change',publish);render();
 }
 mapping(host,step,before,after){
  const target=after.find(row=>row.definition.id===step.targetId);if(!target){host.append(el('p','Destino removido do candidato; retire este mapeamento.'),button('Retirar mapeamento indisponível '+step.targetId,()=>{this.removeMapping(step);this.draw();}));return;}
  const label=title(target),box=el('fieldset');box.append(el('legend',label));host.append(box);
  const conversion=choose('Conversão de '+label,[...DATA_CONVERSIONS,'initialize'].map(kind=>[kind,names[kind]]),step.conversion),destination=choose('Destino preenchido de '+label,[['block','Bloquear e revisar'],['keep','Conservar destino e origem'],['replace','Substituir com original recuperável']],step.destination??'block');box.append(conversion.wrap,destination.wrap);
  const sources=el('div');box.append(sources);const sourceOptions=[['','Escolha a fonte'],...before.map(row=>[row.definition.id,title(row)])];
  if(step.conversion!=='initialize')for(const [index,id]of step.sourceIds.entries()){const source=choose('Fonte '+(index+1)+' de '+label,sourceOptions,id);sources.append(source.wrap);source.input.addEventListener('change',()=>{step.sourceIds[index]=source.input.value;this.invalidate();});}
  if(step.conversion==='join'){box.append(button('Adicionar fonte em '+label,()=>{step.sourceIds.push(before[0]?.definition.id||'');this.invalidate();this.draw();}));if(step.sourceIds.length>1)box.append(button('Retirar última fonte de '+label,()=>{step.sourceIds.pop();this.invalidate();this.draw();}));}
  const preserve=choose('Após converter '+label,[['true','Guardar origem no personagem'],['false','Remover origem, com cópia recuperável']],String(step.preserveSource!==false));box.append(preserve.wrap);
  conversion.input.addEventListener('change',()=>{this.clearInputs();step.conversion=conversion.input.value;step.options={};step.sourceIds=step.conversion==='initialize'?[]:step.sourceIds.length?[step.sourceIds[0]]:[before.find(row=>row.definition.id===step.targetId)?.definition.id||before[0]?.definition.id||''];if(step.conversion==='initialize')step.options.value=Object.hasOwn(target.definition,'initial')?structuredClone(target.definition.initial):null;this.invalidate();this.draw();});
  destination.input.addEventListener('change',()=>{step.destination=destination.input.value;this.invalidate();});preserve.input.addEventListener('change',()=>{step.preserveSource=preserve.input.value==='true';this.invalidate();});step.options??={};
  if(step.conversion==='integer'){const rounding=choose('Arredondamento de '+label,[['exact','Exigir inteiro exato'],['floor','Para baixo'],['ceil','Para cima'],['round','Mais próximo'],['truncate','Descartar fração']],step.options.rounding??'exact');box.append(rounding.wrap);rounding.input.addEventListener('change',()=>{step.options.rounding=rounding.input.value;this.invalidate();});}
  if(['split','join'].includes(step.conversion)){step.options.separator??='';if(step.conversion==='split')step.options.index??=0;const separator=input('Separador de '+label,step.options.separator??'');box.append(separator.wrap);separator.input.addEventListener('input',()=>{step.options.separator=separator.input.value;this.invalidate();});if(step.conversion==='split'){const part=input('Parte de '+label,this.state.raw[label+'-part']??String((step.options.index??0)+1));box.append(part.wrap);part.input.addEventListener('input',()=>{this.state.raw[label+'-part']=part.input.value;try{step.options.index=numberFromText(part.input.value)-1;delete this.state.errors[label+'-part'];}catch(error){this.state.errors[label+'-part']=error.message;}this.invalidate();});}}
  if(step.conversion==='boolean')for(const [key,caption,initial]of [['trueValue','Texto que significa Sim','true'],['falseValue','Texto que significa Não','false']]){const control=input(caption+' em '+label,step.options[key]??initial);box.append(control.wrap);control.input.addEventListener('input',()=>{step.options[key]=control.input.value;this.invalidate();});}
  if(step.conversion==='initialize'){this.literal(box,'Inicial de '+label,label+'-initial',step.options.value,value=>{step.options.value=value;});if(Object.hasOwn(target.definition,'initial'))box.append(button('Usar inicial declarado de '+label,()=>{step.options.value=initializeStructuredValue(target.definition,structuredClone(target.definition.initial));delete this.state.raw[label+'-initial'];this.invalidate();this.draw();}));}
  if(step.conversion==='map'){
   step.options.pairs??=[];const each=choose('Mapear cada identidade de '+label,[['false','Valor inteiro'],['true','Cada item da lista']],String(step.options.each===true));box.append(each.wrap);each.input.addEventListener('change',()=>{step.options.each=each.input.value==='true';this.invalidate();});
   const unmapped=choose('Sem correspondência em '+label,[['block','Bloquear'],['keep','Conservar valor e validar']],step.options.unmapped??'block');box.append(unmapped.wrap);unmapped.input.addEventListener('change',()=>{step.options.unmapped=unmapped.input.value;this.invalidate();});
   for(const [index,pair]of step.options.pairs.entries()){const row=el('fieldset');row.append(el('legend','Correspondência '+(index+1)));box.append(row);this.literal(row,'Origem '+(index+1)+' de '+label,label+'-from-'+index,pair.from,value=>{pair.from=value;});this.literal(row,'Destino '+(index+1)+' de '+label,label+'-to-'+index,pair.to,value=>{pair.to=value;});row.append(button('Remover correspondência '+(index+1)+' de '+label,()=>{this.clearInputs();step.options.pairs.splice(index,1);this.invalidate();this.draw();}));}
   box.append(button('Adicionar correspondência em '+label,()=>{step.options.pairs.push({from:'',to:''});this.invalidate();this.draw();}));
  }
  box.append(button('Retirar mapeamento de '+label,()=>{this.removeMapping(step);this.draw();}));
 }
 draw(){
  const editor=this.editor,state=this.state,pkg=editor.session.validation.document,base=editor.session.source.base;this.host.replaceChildren(el('summary','Migração dos dados instalados'));if(!this.host.open)return;
  this.status=el('p');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');this.host.append(el('p','Rótulos e layouts usam a aplicação habitual. Alterações de armazenamento têm revisão por personagem, cópia dos originais e confirmação conjunta.'),this.status);
  if(!base||!pkg||pkg.system.schemaVersion!==3){this.status.textContent='Abra uma cópia instalada válida em v3 para preparar migração.';return;}
  this.host.append(button(this.enabled?'Cancelar preparação da migração':'Preparar migração dos dados',()=>editor.run(()=>this.enabled?this.disable():this.enable())));
  if(this.enabled){
   this.host.append(el('p',`Revisão dos dados ${systemDataRevision(base.system)} → ${pkg.system.dataRevision??systemDataRevision(pkg.system)}. Todos os personagens vinculados serão conferidos; schemaVersion de personagem permanece preservado.`));
   const before=dataDefinitions(base.system),after=dataDefinitions(pkg.system);for(const step of state.spec.steps)this.mapping(this.host,step,before,after);
   const available=after.filter(row=>!state.spec.steps.some(step=>step.targetId===row.definition.id)),target=choose('Acrescentar mapeamento para',[['','Escolha um dado'],...available.map(row=>[row.definition.id,title(row)])],'');this.host.append(target.wrap,button('Adicionar mapeamento de migração',()=>{const row=after.find(row=>row.definition.id===target.input.value);if(!row)return;const source=before.find(old=>old.definition.id===row.definition.id);state.spec.steps.push({targetId:row.definition.id,sourceIds:source?[source.definition.id]:[],conversion:source?'copy':'initialize',options:source?{}:{value:Object.hasOwn(row.definition,'initial')?structuredClone(row.definition.initial):null},destination:'block',preserveSource:true});this.invalidate();this.draw();}));
   for(const retired of state.spec.retired){const row=before.find(row=>row.definition.id===retired.dataId),choice=choose('Dado descontinuado '+(row?title(row):retired.dataId),[['preserve','Conservar no personagem'],['recovery','Guardar original na recuperação'],['remove','Remover com original recuperável']],retired.disposition);this.host.append(choice.wrap);choice.input.addEventListener('change',()=>{retired.disposition=choice.input.value;this.invalidate();});}
   const metadata=choose('Metadado de revisão já utilizado',[['false','Bloquear para preservar'],['true','Substituir com original recuperável']],String(state.spec.replaceRevisionMetadata===true));this.host.append(metadata.wrap);metadata.input.addEventListener('change',()=>{state.spec.replaceRevisionMetadata=metadata.input.value==='true';this.invalidate();});
   this.host.append(button('Revisar migração e personagens',()=>editor.run(async()=>{if(Object.keys(state.errors).length)throw Error('Corrija os valores de migração pendentes.');editor.assertNoPending();if(!editor.lastRenderedCurrent)await editor.updatePreview();const revision=editor.session.revision,spec=JSON.stringify(state.spec),plan=await editor.onPrepareMigration(editor,structuredClone(state.spec));if(revision!==editor.session.revision||spec!==JSON.stringify(state.spec))throw Error('Escolhas alteradas durante a prévia; revise novamente.');this.review=plan;this.reviewRevision=revision;this.reviewSpec=spec;this.draw();editor.refresh();})));
   if(this.review){const plan=this.review.migration;this.status.textContent=`${plan.status==='ready'?'Migração pronta para confirmação':'Migração bloqueada'} · ${plan.summary.characters} personagens · ${plan.summary.changed} alterados · ${plan.summary.conflicts+plan.diagnostics.length} conflitos.`;this.report(plan);}
  }
  this.host.append(button('Consultar cópias de migração',()=>editor.run(async()=>{this.copies=await editor.onMigrationCopies();this.draw();})));
  for(const entry of this.copies||[]){const box=el('fieldset');box.append(el('legend',entry.name+(entry.available?'':' · indisponível')));this.host.append(box);if(!entry.available){box.append(el('p',entry.error));continue;}
   box.append(button('Baixar originais de '+entry.name,()=>editor.run(async()=>downloadJson(await editor.onMigrationOriginal(entry.key),'originais-migracao.json'))));
   box.append(button('Revisar restauração de '+entry.name,()=>editor.run(async()=>{this.restoration=await editor.onPrepareRestoration(editor,entry.key);this.draw();})));
  }
  if(this.restoration){this.report(this.restoration.restoration);this.host.append(button('Aplicar restauração revisada',()=>editor.run(async()=>{await editor.onRestoreMigration(editor,this.restoration);this.restoration=null;this.copies=await editor.onMigrationCopies();this.draw();})));}
 }
 report(plan){
  for(const issue of plan.diagnostics)this.host.append(el('p',issue.message));
  const definitions=dataDefinitions(this.editor.session.validation.document?.system),labels=new Map(definitions.map(row=>[row.definition.id,title(row)]));
  for(const row of plan.characters.slice(0,this.reportLimit??50)){const box=el('details');box.append(el('summary',row.before?.identity?.name||row.before?.name||row.id||'Personagem indisponível'));this.host.append(box);
   box.append(el('p',`${row.patches.length} alterações de dados; revisão ${row.before?.meta?.systemDataRevision??1} → ${row.after?.meta?.systemDataRevision??1}.`));
   for(const patch of row.patches.slice(0,10))box.append(el('p',`${patch.path.join(' › ')}: ${display({present:patch.beforeExists,value:patch.before})} → ${display({present:patch.afterExists,value:patch.after})}.`));
   for(const sample of row.samples)box.append(el('p',`${labels.get(sample.dataId)||sample.dataId}${sample.entries?.length?' · entradas '+sample.entries.map(entry=>entry.entryId).join(' › '):''}: ${sample.sources.map(display).join(' + ')} → ${display(sample.after)}; destino anterior: ${display(sample.destinationBefore)}.`));
   for(const issue of row.conflicts){box.append(el('p',issue.message));if(issue.dataId&&this.state.spec.steps.some(step=>step.targetId===issue.dataId)){const choice=choose('Conflito de '+issue.dataId+' em '+row.id,[['block','Bloquear'],['keep','Conservar destino e origem'],['replace','Substituir com original recuperável']],this.state.spec.overrides?.find(choice=>choice.characterId===row.id&&choice.targetId===issue.dataId)?.destination??'block');box.append(choice.wrap);choice.input.addEventListener('change',()=>{this.state.spec.overrides??=[];this.state.spec.overrides=this.state.spec.overrides.filter(choice=>choice.characterId!==row.id||choice.targetId!==issue.dataId);this.state.spec.overrides.push({characterId:row.id,targetId:issue.dataId,destination:choice.input.value});this.invalidate();});}}
  }
  if(plan.characters.length>(this.reportLimit??50))this.host.append(button('Mostrar mais 50 personagens',()=>{this.reportLimit=(this.reportLimit??50)+50;this.draw();}));
 }
}
