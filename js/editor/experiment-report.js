import {dataIndex} from './data-index.js';
import {getByPath} from '../engine/paths.js';
import {el} from './authoring-dom.js';
import {initializeData,readData} from '../engine/data-definitions.js';
import {entryLabel} from '../engine/data-references.js';
import {createRuleContext} from '../engine/rule-registry.js';
export function humanValue(value){if(value===undefined)return 'Ausente';if(value===null)return 'null explícito';if(value===true)return 'Sim';if(value===false)return 'Não';if(value==='')return 'Texto vazio';if(Array.isArray(value))return value.length+' entrada(s)';if(typeof value==='object')return Object.keys(value).length+' campo(s)';return String(value);}
export function rollReadings(result){const snapshot=result.snapshot||{},rows=[];for(const source of [...(snapshot.source?[snapshot.source]:[]),...(Array.isArray(snapshot.sources)?snapshot.sources:[])])rows.push({label:source.label||'Fonte registrada',value:humanValue(source.value)});const labels={value:'Valor da fonte',modifier:'Modificador total',target:'Alvo ou oposição',wild:'Dado selvagem',untrained:'Sem treinamento',momentum:'Ímpeto'};for(const [key,label]of Object.entries(labels))if(Object.hasOwn(snapshot.options||{},key))rows.push({label,value:humanValue(snapshot.options[key])});if(Object.hasOwn(snapshot,'manualModifier'))rows.push({label:'Modificador informado pela mesa',value:humanValue(snapshot.manualModifier)});for(const effect of snapshot.effects?.contributions||[])rows.push({label:'Efeito: '+effect.label,value:humanValue(effect.value)+' · revisão '+effect.revision});return rows;}
export function experimentRows(pkg,character){
 const indexed=dataIndex(pkg),typedFields=new Set(indexed.filter(r=>r.typed).map(r=>r.field));
 const rows=indexed.filter(r=>r.scope==='character'&&!r.typed&&!typedFields.has(r.field)&&!['meta','schemaVersion'].includes(r.field)&&!r.field.startsWith('meta.')).map(row=>{let value;try{value=getByPath(character,row.field);}catch{value=undefined;}return {...row,initial:row.value,current:value,changed:JSON.stringify(value)!==JSON.stringify(row.value)};});
 if(pkg.system.schemaVersion!==3)return rows;
 // Compare with a newly created sample; never initialize the current character.
 const baseline=initializeData(pkg.system,structuredClone(pkg.system.characterTemplate)),contexts=new Map();
 const read=(source,id,context)=>{try{return readData(pkg.system,source,id,context);}catch(error){return {present:false,error:error.message};}};
 const append=(row,initial,current)=>rows.push({...row,initial,current,changed:JSON.stringify(initial)!==JSON.stringify(current)});
 const walk=(definitions,context={entries:[]},trail=[])=>{for(const definition of definitions||[]){
  const before=read(baseline,definition.id,context),now=read(character,definition.id,context),label=[...trail,definition.label].join(' › ');
  append({dataId:definition.id,typed:true,label,context:structuredClone(context)},before.value,now.value);
  if(definition.type==='record')walk(definition.fields,context,[...trail,definition.label]);
  if(definition.type==='collection'){
   const entries=new Map();for(const cell of [before,now])if(Array.isArray(cell.value))for(const entry of cell.value)entries.set(entry.id,entry);
   for(const entry of entries.values()){const child={entries:[...context.entries,{dataId:definition.id,entryId:entry.id}]};if(!contexts.has(definition.id))contexts.set(definition.id,[]);contexts.get(definition.id).push(child);walk(definition.fields,child,[...trail,definition.label,entryLabel(entry,definition.fields)]);}
  }
 }};walk(pkg.system.dataDefinitions);
 let beforeRules,nowRules;try{beforeRules=createRuleContext(pkg.system,baseline);nowRules=createRuleContext(pkg.system,character);}catch(error){append({label:'Diagnóstico dos cálculos'},undefined,error.message);return rows;}
 const evaluate=(engine,id,context)=>{try{return engine.evaluate(id,context);}catch(error){return 'Erro: '+error.message;}};
 for(const rule of pkg.system.rules||[])for(const context of rule.context?contexts.get(rule.context.dataId)||[]:[{entries:[]}]){
  const suffix=context.entries.map(e=>e.entryId).join(' › ');append({ruleId:rule.id,label:rule.label+(suffix?' · '+suffix:''),context},evaluate(beforeRules,rule.id,context),evaluate(nowRules,rule.id,context));
 }
 return rows;
}
export function renderExperimentReport(host,pkg,snapshot){
 host.replaceChildren(el('h3','Leituras e resultados do ensaio'),el('p','Valores da amostra no momento desta consulta, comparados à criação com template e iniciais explícitos. Cálculos mostram o valor automático atual. Use Conferir novamente depois de jogar. Nenhum valor desta tabela altera o pacote ou a biblioteca. Rolagens do histórico são snapshots; custos e registros aparecem nos dados alterados.','editor-note'));
 const rows=experimentRows(pkg,snapshot.character),changed=rows.filter(r=>r.changed);host.append(el('p',changed.length+' leitura(s) diferente(s) do template.'));
 const table=el('table'),header=el('tr');for(const text of ['Dado','No template','Na consulta','Alterado'])header.append(el('th',text));const head=el('thead');head.append(header);const body=el('tbody');for(const row of rows.slice(0,500)){const tr=el('tr');for(const text of [row.label,humanValue(row.initial),humanValue(row.current),row.changed?'Sim':'Não'])tr.append(el('td',text));body.append(tr);}table.append(head,body);host.append(table);if(rows.length>500)host.append(el('p','Tabela mostra as primeiras 500 leituras. Os dados completos permanecem na amostra.'));
 const history=el('ol');for(const result of (Array.isArray(snapshot.history)?snapshot.history:[]).slice(0,20)){const li=el('li');li.append(el('strong',result.label||'Rolagem'),el('p','Resultado: '+humanValue(result.total)+(result.detail?' · '+humanValue(result.detail):'')));if(result.formula)li.append(el('p','Dados usados: '+result.formula));const readings=rollReadings(result);if(readings.length){const source=el('details');source.append(el('summary','Fontes, opções e efeitos registrados'));for(const row of readings)source.append(el('p',row.label+': '+row.value));li.append(source);}history.append(li);}host.append(el('h4','Histórico de rolagens da amostra'),history);if(!history.children.length)host.append(el('p','Ainda não há rolagens registradas. Ações sem rolagem podem alterar os dados acima.'));
}
