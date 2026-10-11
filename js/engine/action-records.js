import {ACTION_LIMITS} from './action-plan.js';
import {safeDataId} from './data-types.js';
import {validateResolution} from './roll-transcript.js';
import {RESERVED_KEYS} from './paths.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bytes=value=>new TextEncoder().encode(JSON.stringify(value)).length;
const validContext=value=>object(value)&&Object.keys(value).every(key=>key==='entries')&&(value.entries===undefined||Array.isArray(value.entries)&&value.entries.length<=8&&value.entries.every(entry=>object(entry)&&safeDataId(entry.dataId)&&safeDataId(entry.entryId)));
export async function actionSignature(system,action){
 if(!globalThis.crypto?.subtle)throw Error('Assinatura de retomada indisponível neste navegador.');const result=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({system,action})));return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');
}
export function validateActionRecords(character,{root='character'}={}){
 const records=character.actionRecords;if(records===undefined)return [];const issues=[],add=message=>issues.push({path:root+'.actionRecords',message,code:'action.records'});
 if(character.schemaVersion!==3){add('Registros recuperáveis exigem personagem v3 habilitado explicitamente.');return issues;}
 if(!Array.isArray(records)||records.length>ACTION_LIMITS.records){add('Use até50 registros; arquive os concluídos explicitamente antes de iniciar outro.');return issues;}if(bytes(records)>ACTION_LIMITS.recordsBytes)add('Registros excedem512 KiB; preserve/exporte e arquive os concluídos.');
 const ids=new Set();for(const record of records){
  if(!object(record)||!safeDataId(record.id)||ids.has(record.id)){add('Identidade de execução ausente ou duplicada.');continue;}ids.add(record.id);if(bytes(record)>ACTION_LIMITS.recordBytes)add('Registro excede64 KiB.');
  if(record.version!==1||!safeDataId(record.actionId)||!Number.isSafeInteger(record.revision)||record.revision<1||!['preview','activation'].includes(record.profile)||!['activated','resolved','complete'].includes(record.phase)||typeof record.signature!=='string'||!/^[a-f0-9]{64}$/.test(record.signature)||typeof record.createdAt!=='string'||!Number.isFinite(Date.parse(record.createdAt)))add('Versão, origem, marco, assinatura ou data de registro inválidos.');
  if(record.profile==='preview'&&record.phase!=='complete')add('Prévia integral só registra a conclusão confirmada.');
  if(!object(record.inputs)||!validContext(record.dataContext)||!object(record.locals)||!object(record.generatedIds)||!object(record.transcripts)||!Array.isArray(record.readings)||record.readings.length>10000||!Array.isArray(record.payments)||record.payments.length>ACTION_LIMITS.costs)add('Snapshot limitado de execução inválido.');
  for(const reading of Array.isArray(record.readings)?record.readings:[]){if(!object(reading)||!safeDataId(reading.dataId)||!validContext(reading.context)||!object(reading.cell)||typeof reading.cell.present!=='boolean'||Object.hasOwn(reading.cell,'value')!==reading.cell.present)add('Leitura com presença inválida.');}
  let totalDraws=0;
  for(const transcript of Object.values(record.transcripts||{})){
   try{validateResolution(transcript.configuration);}catch(error){add(error.message);continue;}if(transcript.version!==1||typeof transcript.actionId!=='string'||!Array.isArray(transcript.draws)||transcript.draws.length>100||!object(transcript.choices)){add('Transcript de resolução inválido.');continue;}
   totalDraws+=transcript.draws.length;
   const drawIds=new Set();for(const draw of transcript.draws){if(!object(draw)||typeof draw.id!=='string'||!draw.id||drawIds.has(draw.id)||!Number.isSafeInteger(draw.sides)||draw.sides<1||draw.sides>100000||!Number.isSafeInteger(draw.value)||draw.value<1||draw.value>draw.sides)add('Lançamento registrado inválido.');if(object(draw))drawIds.add(draw.id);}
  }
  if(totalDraws>100)add('Orçamento global de100 lançamentos excedido no registro.');
  for(const payment of Array.isArray(record.payments)?record.payments:[])if(!object(payment)||!safeDataId(payment.dataId)||!['remaining','used'].includes(payment.mode)||['before','after','amount'].some(k=>typeof payment[k]!=='number'||!Number.isFinite(payment[k])||payment[k]<0)||payment.after!==(payment.mode==='used'?payment.before+payment.amount:payment.before-payment.amount))add('Pagamento registrado inválido.');
  if(record.error!==undefined&&(typeof record.error!=='string'||record.error.length>2000))add('Diagnóstico de retomada inválido.');
  if(!Array.isArray(record.reserves)||record.reserves.length>ACTION_LIMITS.costs||!object(record.basis))add('Reservas e baseline de ajustes exigidos.');
  if(object(record.generatedIds)&&Object.entries(record.generatedIds).some(([key,value])=>!safeDataId(key)||!safeDataId(value)))add('Identidades de entradas geradas inválidas.');
  for(const reserve of Array.isArray(record.reserves)?record.reserves:[])if(!object(reserve)||!safeDataId(reserve.id)||typeof reserve.reserved!=='number'||!Number.isFinite(reserve.reserved)||reserve.reserved<0)add('Reserva registrada inválida.');
  for(const key of ['overrides','effects']){const cell=record.basis?.[key];if(!object(cell)||typeof cell.present!=='boolean'||Object.hasOwn(cell,'value')!==cell.present)add('Baseline de ajustes/efeitos inválida.');}
  if(record.success!==undefined&&record.success!==null&&typeof record.success!=='boolean')add('Sucesso registrado deve ser booleano ou null.');
  if(record.results!==undefined&&(!Array.isArray(record.results)||record.results.length>ACTION_LIMITS.steps||record.results.some(r=>!object(r)||!safeDataId(r.id)||typeof r.label!=='string'||typeof r.total!=='number'||!Number.isFinite(r.total)||typeof r.rolled!=='boolean'||typeof r.outcome!=='string'||r.success!==undefined&&typeof r.success!=='boolean')))add('Resultados registrados inválidos.');
  if(Object.keys(record).some(k=>!['version','id','actionId','revision','profile','phase','signature','createdAt','inputs','dataContext','locals','generatedIds','readings','transcripts','payments','reserves','basis','results','success','error','extensions'].includes(k)||RESERVED_KEYS.has(k)))add('Parâmetro de registro indisponível.');
 }
 return issues;
}
export function assertActionRecordCapacity(character,record){const records=[...(character.actionRecords||[])],index=records.findIndex(r=>r.id===record.id);if(index<0)records.push(record);else records[index]=record;const draft={...character,actionRecords:records},issues=validateActionRecords(draft);if(issues.length)throw Error(issues[0].message);return records;}
export function archiveCompletedRecords(character,ids){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!character.actionRecords?.some(r=>r.id===id&&r.phase==='complete')))throw Error('Só registros concluídos existentes podem ser arquivados.');return (character.actionRecords||[]).filter(r=>!ids.includes(r.id));
}
