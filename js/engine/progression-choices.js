import {dataDefinition,dataDefinitions,readData,writeData} from './data-definitions.js';
import {safeDataId,initialRecord} from './data-types.js';
import {compileActionExpression,evaluateCompiledActionExpression} from './action-expression.js';
import {requirePredicate,predicateBindingIssue} from './predicates.js';
import {changesBetween} from './character-history.js';

export const PROGRESSION_LIMITS=Object.freeze({options:100,choices:20,alternatives:20,grants:20,grantDefinitions:500,acquisitionGrants:100,records:100,bytes:262144});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed,label)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error(label+': parâmetros indisponíveis.');};
const integer=(value,min,max,label)=>{if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(label+': inteiro fora do intervalo.');};
const named=(value,label)=>{if(!safeDataId(value.id)||typeof value.label!=='string'||!value.label.trim()||value.label.length>2000)throw Error(label+': identidade e nome exigidos.');};
const unique=(rows,max,label)=>{if(!Array.isArray(rows)||rows.length>max||new Set(rows.map(row=>row?.id)).size!==rows.length)throw Error(label+': lista limitada e identidades únicas exigidas.');};
const globalDefinition=(system,id)=>{const row=dataDefinitions(system).find(row=>row.definition.id===id);if(!row||row.ancestors.some(parent=>parent.type==='collection'))throw Error('Escolha dado global existente.');return row.definition;};
const cellEqual=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ledgerOf=character=>character.progressionLedger||{version:1,phase:'creation',records:[]};
const activeGrants=ledger=>ledger.records.filter(record=>record.status==='active').flatMap(record=>record.grants);

export function compileProgression(system){
 if(system.schemaVersion!==3)throw Error('Progressão tipada exige sistema v3.');const config=system.progressionChoices;
 keys(config,['version','revision','creationDataId','evolutionDataId','reopenCreation','revocation','options','extensions'],'Progressão');
 if(config.version!==1)throw Error('Versão de progressão indisponível.');integer(config.revision,1,1000000,'Revisão');
 if(typeof config.reopenCreation!=='boolean'||!['noRefund','originalCost'].includes(config.revocation))throw Error('Declare reabertura e política de revogação.');
 for(const id of [config.creationDataId,config.evolutionDataId])if(!['number','integer'].includes(globalDefinition(system,id).type))throw Error('Orçamento exige dado numérico global.');
 if(config.creationDataId===config.evolutionDataId)throw Error('Criação e evolução exigem orçamentos separados.');unique(config.options,PROGRESSION_LIMITS.options,'Opções');
 const index=new Map(config.options.map(option=>[option.id,option])),compiled=new Map();let grantCount=0;
 const grant=(value)=>{
  keys(value,['id','label','type','dataId','expression','values','actionId'],'Concessão');named(value,'Concessão');
  if(++grantCount>PROGRESSION_LIMITS.grantDefinitions)throw Error('Limite de definições de concessão excedido.');
  const definition=globalDefinition(system,value.dataId);
  if(!['set','add','append'].includes(value.type)||value.type==='add'&&!['number','integer'].includes(definition.type)||value.type==='append'&&definition.type!=='collection'||value.type==='set'&&['record','collection'].includes(definition.type))throw Error('Operação de concessão incompatível com o dado.');
  if(value.actionId!==undefined&&!system.sheetActions?.some(action=>action.id===value.actionId))throw Error('Ação concedida inexistente.');
  if(value.type==='append'){
   if(value.expression!==undefined||!object(value.values))throw Error('Concessão de entrada exige campos por identidade.');
   const values=Object.entries(value.values).map(([id,ast])=>{const field=definition.fields.find(field=>field.id===id);if(!field)throw Error('Campo concedido não pertence à coleção.');return {field,expression:compileActionExpression(system,ast,field.type==='integer'?'number':field.type,{expectedDefinition:field,label:value.label})};});return {grant:value,definition,values};
  }
  if(value.values!==undefined)throw Error('Campos só pertencem à concessão de entrada.');
  return {grant:value,expression:compileActionExpression(system,value.expression,value.type==='add'||definition.type==='integer'?'number':definition.type,{...(value.type==='add'?{}:{expectedDefinition:definition}),label:value.label})};
 };
 for(const option of config.options){
  keys(option,['id','label','modes','requires','allowWhen','maxAcquisitions','cost','grants','choices','extensions'],'Opção');named(option,'Opção');
  if(!Array.isArray(option.modes)||!option.modes.length||new Set(option.modes).size!==option.modes.length||option.modes.some(mode=>!['creation','paid','narrative'].includes(mode)))throw Error('Declare origens permitidas para a opção.');integer(option.maxAcquisitions,1,100,'Aquisições máximas');
  if(!Array.isArray(option.requires)||new Set(option.requires).size!==option.requires.length||option.requires.some(id=>!index.has(id)||id===option.id))throw Error('Pré-requisito de opção inexistente ou repetido.');
  if(option.allowWhen!==undefined){const issue=predicateBindingIssue(system,option.allowWhen,{collections:[]});if(issue)throw Error(issue);}
  keys(option.cost,['creation','paid'],'Custos');for(const mode of ['creation','paid'])if(option.modes.includes(mode)&&option.cost[mode]===undefined)throw Error('Custo explícito exigido para '+mode+'.');
  const costs=Object.fromEntries(Object.entries(option.cost).map(([mode,ast])=>[mode,compileActionExpression(system,ast,'number',{label:option.label})]));
  unique(option.grants,PROGRESSION_LIMITS.grants,'Concessões');unique(option.choices,PROGRESSION_LIMITS.choices,'Escolhas');const ids=new Set(option.grants.map(value=>value.id));
  const choices=option.choices.map(choice=>{
   keys(choice,['id','label','minimum','maximum','options'],'Escolha');named(choice,'Escolha');unique(choice.options,PROGRESSION_LIMITS.alternatives,'Alternativas');integer(choice.minimum,0,choice.options.length,'Mínimo');integer(choice.maximum,choice.minimum,choice.options.length,'Máximo');
   return {choice,options:choice.options.map(alternative=>{keys(alternative,['id','label','grants'],'Alternativa');named(alternative,'Alternativa');unique(alternative.grants,PROGRESSION_LIMITS.grants,'Concessões');return {alternative,grants:alternative.grants.map(value=>{if(ids.has(value.id))throw Error('Identidade de concessão duplicada na opção.');ids.add(value.id);return grant(value);})};})};
  });compiled.set(option.id,{option,costs,grants:option.grants.map(grant),choices});
 }
 const visiting=new Set(),done=new Set(),visit=id=>{if(visiting.has(id))throw Error('Ciclo de pré-requisitos de progressão.');if(done.has(id))return;visiting.add(id);for(const dependency of index.get(id).requires)visit(dependency);visiting.delete(id);done.add(id);};for(const id of index.keys())visit(id);
 return {config,index:compiled};
}

export function progressionLedgerIssues(character,system){
 const ledger=character.progressionLedger;if(ledger===undefined)return [];const issues=[];
 try{
  if(character.schemaVersion!==3)throw Error('Registros de progressão exigem personagem v3.');keys(ledger,['version','phase','records','creationSnapshot','previousSnapshots'],'Registros de progressão');
  if(ledger.version!==1||!['creation','play'].includes(ledger.phase))throw Error('Versão/fase de progressão inválida.');unique(ledger.records,PROGRESSION_LIMITS.records,'Registros');
  if(new TextEncoder().encode(JSON.stringify(ledger)).length>PROGRESSION_LIMITS.bytes)throw Error('Registros de progressão excedem o orçamento; preserve uma cópia antes de remover dados.');
  const grantIds=new Set(),checkCell=cell=>{keys(cell,['present','value'],'Snapshot de dado');if(typeof cell.present!=='boolean'||cell.present!==Object.hasOwn(cell,'value'))throw Error('Presença do snapshot inválida.');};
  const snapshot=value=>{keys(value,['revision','remaining','spent','acquisitions','allocations'],'Snapshot de criação');integer(value.revision,1,1000000,'Revisão inicial');integer(value.spent,0,100000000,'Gasto inicial');if(typeof value.remaining!=='number'||!Number.isFinite(value.remaining)||value.remaining<0||!Array.isArray(value.acquisitions)||value.acquisitions.length>100||new Set(value.acquisitions).size!==value.acquisitions.length||value.acquisitions.some(id=>!safeDataId(id))||!object(value.allocations))throw Error('Snapshot inicial inválido.');for(const [id,cell]of Object.entries(value.allocations)){if(!safeDataId(id))throw Error('Dado inicial inválido.');checkCell(cell);}};
  for(const record of ledger.records){
   keys(record,['id','optionId','label','definitionRevision','mode','status','requires','selections','cost','grants','definitionSnapshot'],'Aquisição');named(record,'Aquisição');
   if(!safeDataId(record.optionId)||!['creation','paid','narrative'].includes(record.mode)||!['active','revoked'].includes(record.status))throw Error('Origem/estado da aquisição inválido.');integer(record.definitionRevision,1,1000000,'Revisão registrada');
   if(!Array.isArray(record.requires)||new Set(record.requires).size!==record.requires.length||record.requires.some(id=>!safeDataId(id))||!object(record.selections)||Object.entries(record.selections).some(([id,values])=>!safeDataId(id)||!Array.isArray(values)||values.length>20||new Set(values).size!==values.length||values.some(id=>!safeDataId(id))))throw Error('Requisitos/escolhas registrados inválidos.');
   keys(record.cost,['dataId','amount'],'Custo registrado');integer(record.cost.amount,0,1000000,'Custo registrado');if(!safeDataId(record.cost.dataId))throw Error('Dado de orçamento inválido.');unique(record.grants,PROGRESSION_LIMITS.grants*(PROGRESSION_LIMITS.choices+1),'Concessões registradas');
   for(const grant of record.grants){keys(grant,['id','definitionId','label','type','dataId','amount','cell','anchor','entryId','actionId'],'Concessão registrada');named(grant,'Concessão registrada');if(grantIds.has(grant.id))throw Error('Identidade de proveniência duplicada.');grantIds.add(grant.id);if(!safeDataId(grant.definitionId)||!safeDataId(grant.dataId)||!['set','add','append'].includes(grant.type)||grant.actionId!==undefined&&!safeDataId(grant.actionId))throw Error('Proveniência de concessão inválida.');checkCell(grant.anchor);if(grant.type==='add'&&(typeof grant.amount!=='number'||!Number.isFinite(grant.amount)||grant.cell!==undefined||grant.entryId!==undefined))throw Error('Contribuição numérica inválida.');if(grant.type!=='add'){checkCell(grant.cell);if(!grant.cell.present||grant.amount!==undefined||grant.type==='set'&&grant.entryId!==undefined)throw Error('Valor concedido inválido.');}if(grant.type==='append'&&(!safeDataId(grant.entryId)||!object(grant.cell.value)||grant.cell.value.id!==grant.entryId))throw Error('Entrada concedida exige identidade.');if(system)globalDefinition(system,grant.dataId);}
   if(!object(record.definitionSnapshot))throw Error('Snapshot da opção exigido.');
  }
  if(ledger.phase==='play'&&!object(ledger.creationSnapshot))throw Error('Criação concluída exige snapshot.');if(ledger.creationSnapshot!==undefined)snapshot(ledger.creationSnapshot);
  if(ledger.previousSnapshots!==undefined&&(!Array.isArray(ledger.previousSnapshots)||ledger.previousSnapshots.length>20))throw Error('Limite de snapshots de reabertura excedido.');
  for(const previous of ledger.previousSnapshots||[])snapshot(previous);
 }catch(error){issues.push({path:'character.progressionLedger',message:error.message,code:'progression'});}return issues;
}

function prepared(system,character,draft,id,details){
 if(!safeDataId(id))throw Error('Identidade da operação inválida.');
 const issues=progressionLedgerIssues(draft,system);if(issues.length)throw Error(issues[0].message);const {meta,...basis}=structuredClone(character);
 return {version:1,id,eventBasis:basis,eventDefinition:JSON.stringify(system),patches:changesBetween(character,draft),details};
}

export function prepareProgressionChoice(system,character,{optionId,mode,selections={},id=crypto.randomUUID()}={}){
 if(character.schemaVersion!==3)throw Error('Habilite personagem v3 explicitamente.');const {config,index}=compileProgression(system),row=index.get(optionId);if(!row)throw Error('Opção de progressão inexistente.');
 const ledger=ledgerOf(character),{option}=row;if(!safeDataId(id)||ledger.records.some(record=>record.id===id))throw Error('Identidade de aquisição duplicada ou inválida.');
 if(!option.modes.includes(mode)||mode==='creation'&&ledger.phase!=='creation'||mode!=='creation'&&ledger.phase!=='play')throw Error('Origem incompatível com a fase atual.');
 const acquired=ledger.records.filter(record=>record.status==='active');if(acquired.filter(record=>record.optionId===optionId).length>=option.maxAcquisitions)throw Error('Opção já adquirida até seu limite.');if(option.requires.some(required=>!acquired.some(record=>record.optionId===required)))throw Error('Pré-requisito de aquisição não atendido.');
 const budget={remaining:100000};requirePredicate(system,character,option.allowWhen,{budget});if(!object(selections)||Object.keys(selections).some(key=>!option.choices.some(choice=>choice.id===key)))throw Error('Escolha subordinada desconhecida.');
 const grants=[...row.grants];for(const choiceRow of row.choices){const selected=selections[choiceRow.choice.id]||[];if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.length<choiceRow.choice.minimum||selected.length>choiceRow.choice.maximum||selected.some(id=>!choiceRow.options.some(row=>row.alternative.id===id)))throw Error(choiceRow.choice.label+': cardinalidade ou opção inválida.');for(const selectedId of selected)grants.push(...choiceRow.options.find(row=>row.alternative.id===selectedId).grants);}
 if(grants.length>PROGRESSION_LIMITS.acquisitionGrants)throw Error('Limite de concessões por aquisição excedido.');
 const amount=mode==='narrative'?0:evaluateCompiledActionExpression(row.costs[mode],character,{budget});integer(amount,0,1000000,'Custo da aquisição');const dataId=mode==='creation'?config.creationDataId:config.evolutionDataId,balance=readData(system,character,dataId);
 if(mode!=='narrative'&&(!balance.present||typeof balance.value!=='number'||!Number.isFinite(balance.value)||balance.value<amount))throw Error('Orçamento ausente ou insuficiente.');
 const draft=structuredClone(character),next=structuredClone(ledger),record={id,optionId,label:option.label,definitionRevision:config.revision,mode,status:'active',requires:structuredClone(option.requires),selections:structuredClone(selections),cost:{dataId,amount},grants:[],definitionSnapshot:structuredClone(option)},details=[option.label+' · '+mode+' · custo '+amount];
 // Every expression observes the same source snapshot. No grant manufactures a
 // prerequisite or changes the price of a later grant in this acquisition.
 for(const compiled of grants){
  const grant=compiled.grant,value=grant.type==='append'?{...initialRecord(compiled.definition),...Object.fromEntries(compiled.values.map(row=>[row.field.binding,evaluateCompiledActionExpression(row.expression,character,{budget})]))}:evaluateCompiledActionExpression(compiled.expression,character,{budget}),before=readData(system,draft,grant.dataId),contributors=[...activeGrants(next),...record.grants].filter(row=>row.dataId===grant.dataId);
  if(contributors.some(row=>row.type!==grant.type))throw Error('Concessões de tipos diferentes no mesmo dado exigem resolução explícita.');
  const anchor=structuredClone(contributors[0]?.anchor||before),entry={id:crypto.randomUUID(),definitionId:grant.id,label:grant.label,type:grant.type,dataId:grant.dataId,anchor,...(grant.actionId?{actionId:grant.actionId}:{})};
  if(grant.type==='set'){
   const replacement={present:true,value},dependencies=new Set(),visit=id=>{if(dependencies.has(id))return;dependencies.add(id);for(const dependency of index.get(id)?.option.requires||[])visit(dependency);};for(const dependency of option.requires)visit(dependency);
   const different=contributors.filter(row=>!cellEqual(row.cell,replacement));
   if(different.some(grant=>!next.records.some(source=>source.status==='active'&&dependencies.has(source.optionId)&&source.grants.some(row=>row.id===grant.id))))throw Error('Concessões incompatíveis no mesmo dado.');
   if(contributors.length&&!cellEqual(before,contributors.at(-1).cell))throw Error('Dado concedido foi editado; aquisição bloqueada para preservar a edição.');entry.cell=structuredClone(replacement);writeData(system,draft,grant.dataId,entry.cell);
  }
  else if(grant.type==='add'){if(!before.present||typeof before.value!=='number'||!Number.isFinite(before.value)||typeof value!=='number'||!Number.isFinite(value))throw Error('Contribuição exige base e quantidade numéricas.');entry.amount=value;writeData(system,draft,grant.dataId,{present:true,value:before.value+value});}
  else{if(!before.present||!Array.isArray(before.value)||!object(value))throw Error('Concessão de entrada exige coleção presente e registro.');entry.entryId=crypto.randomUUID();entry.cell={present:true,value:{...structuredClone(value),id:entry.entryId}};writeData(system,draft,grant.dataId,{present:true,value:[...before.value,entry.cell.value]});}
  record.grants.push(entry);details.push(grant.label+' → '+dataDefinition(system,grant.dataId).label);
 }
 // A grant cannot also overwrite its own budget: this would erase payment.
 if(grants.some(row=>row.grant.dataId===dataId))throw Error('Concessão e pagamento não podem escrever o mesmo orçamento.');if(mode!=='narrative')writeData(system,draft,dataId,{present:true,value:balance.value-amount});next.records.push(record);draft.progressionLedger=next;
 return prepared(system,character,draft,id,details);
}

export function prepareProgressionPhase(system,character,type,{id=crypto.randomUUID()}={}){
 const {config}=compileProgression(system);if(character.schemaVersion!==3)throw Error('Habilite personagem v3 explicitamente.');const draft=structuredClone(character),ledger=structuredClone(ledgerOf(character));
 if(type==='complete'){
  if(ledger.phase!=='creation')throw Error('Criação já concluída.');const balance=readData(system,character,config.creationDataId);if(!balance.present||typeof balance.value!=='number'||balance.value<0)throw Error('Orçamento de criação inválido.');
  ledger.phase='play';ledger.creationSnapshot={revision:config.revision,remaining:balance.value,spent:ledger.records.filter(record=>record.mode==='creation'&&record.status==='active').reduce((sum,record)=>sum+record.cost.amount,0),acquisitions:ledger.records.filter(record=>record.mode==='creation'&&record.status==='active').map(record=>record.id),allocations:Object.fromEntries(dataDefinitions(system).filter(row=>!row.ancestors.length).map(row=>[row.definition.id,readData(system,character,row.definition.id)]))};
 }else if(type==='reopen'){
  if(!config.reopenCreation||ledger.phase!=='play'||ledger.records.some(record=>record.mode!=='creation'))throw Error('Reabrir exige política explícita e ausência de histórico de evolução.');ledger.previousSnapshots??=[];ledger.previousSnapshots.push(ledger.creationSnapshot);delete ledger.creationSnapshot;ledger.phase='creation';
 }else throw Error('Mudança de fase indisponível.');draft.progressionLedger=ledger;return prepared(system,character,draft,id,[type==='complete'?'Concluir criação e guardar snapshot; sobra não vira evolução.':'Reabrir criação preservando o snapshot anterior e os preços registrados.']);
}

export function prepareProgressionRevocation(system,character,recordId,{id=crypto.randomUUID()}={}){
 const {config}=compileProgression(system),draft=structuredClone(character),ledger=structuredClone(ledgerOf(character)),record=ledger.records.find(record=>record.id===recordId);if(!record||record.status!=='active')throw Error('Aquisição ativa inexistente.');
 if(record.mode==='creation'&&ledger.phase!=='creation')throw Error('Reabra criação antes de revogar uma escolha inicial.');if(ledger.records.some(other=>other.status==='active'&&other.id!==recordId&&other.requires.includes(record.optionId)))throw Error('Uma aquisição dependente exige revogação anterior.');
 const all=activeGrants(ledger),remaining=ledger.records.filter(other=>other.status==='active'&&other.id!==recordId).flatMap(other=>other.grants),handled=new Set();
 for(const grant of record.grants){
  const key=grant.type+':'+grant.dataId;if(grant.type!=='append'&&handled.has(key))continue;handled.add(key);const cell=readData(system,draft,grant.dataId),owners=all.filter(row=>row.dataId===grant.dataId),others=remaining.filter(row=>row.dataId===grant.dataId);
  if(grant.type==='set'){if(!cellEqual(cell,grant.cell))throw Error('Dado concedido foi editado; revogação bloqueada para preservar a edição.');writeData(system,draft,grant.dataId,others.at(-1)?.cell||grant.anchor);}
  else if(grant.type==='add'){
   const expected=(grant.anchor.present?grant.anchor.value:0)+owners.reduce((sum,row)=>sum+row.amount,0);if(!cell.present||cell.value!==expected)throw Error('Contribuição foi usada ou editada; revogação exige resolução do conflito.');const amount=record.grants.filter(row=>row.dataId===grant.dataId).reduce((sum,row)=>sum+row.amount,0);writeData(system,draft,grant.dataId,{present:true,value:cell.value-amount});
  }else{const entry=cell.value?.find(value=>value.id===grant.entryId);if(!entry||!cellEqual({present:true,value:entry},grant.cell))throw Error('Entrada concedida foi removida/editada; revogação bloqueada.');writeData(system,draft,grant.dataId,{present:true,value:cell.value.filter(value=>value.id!==grant.entryId)});}
 }
 if(config.revocation==='originalCost'&&record.cost.amount){const balance=readData(system,draft,record.cost.dataId);if(!balance.present||typeof balance.value!=='number')throw Error('Orçamento original indisponível.');writeData(system,draft,record.cost.dataId,{present:true,value:balance.value+record.cost.amount});}
 record.status='revoked';draft.progressionLedger=ledger;return prepared(system,character,draft,id,['Revogar '+record.label+'; preservar concessões de outras origens.',config.revocation==='originalCost'?'Devolver somente o preço registrado: '+record.cost.amount:'Sem devolução de custo.']);
}
