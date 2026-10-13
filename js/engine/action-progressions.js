import {compileProgression,prepareProgressionChoice} from './progression-choices.js';
import {evaluateCompiledActionExpression} from './action-expression.js';
import {readData} from './data-definitions.js';
import {applyCharacterChanges} from './character-history.js';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function compileActionAcquisition(system,step,expression){
 if(Object.keys(step).some(key=>!['id','label','type','optionId','mode','selections','when'].includes(key)))throw Error('Aquisição: parâmetros indisponíveis.');
 const {config,index}=compileProgression(system),row=index.get(step.optionId);
 if(!row||!row.option.modes.includes(step.mode))throw Error('Escolha uma opção de progressão e origem compatíveis.');
 const selections=step.selections||{};if(!object(selections)||Object.keys(selections).some(id=>!row.option.choices.some(choice=>choice.id===id)))throw Error('Escolha subordinada da aquisição indisponível.');
 const choices=row.option.choices.map(choice=>{
  const selected=selections[choice.id]||{};if(!object(selected)||Object.keys(selected).some(id=>!choice.options.some(option=>option.id===id)))throw Error('Alternativa da aquisição indisponível.');
  return {choice,alternatives:Object.entries(selected).map(([id,ast])=>({id,value:expression(ast,'boolean')}))};
 });
 return {step,acquisition:{config,row,choices},when:step.when?expression(step.when,'boolean'):null};
}
export function acquisitionReserve(compiled,character,options){
 const {step,acquisition:{config,row}}=compiled;if(step.mode==='narrative')return null;
 const amount=evaluateCompiledActionExpression(row.costs[step.mode],character,options);
 if(!Number.isSafeInteger(amount)||amount<0||amount>1000000)throw Error('Custo da aquisição exige inteiro não negativo até1000000.');
 return {dataId:step.mode==='creation'?config.creationDataId:config.evolutionDataId,amount,label:row.option.label};
}
export function applyActionAcquisition(system,draft,row,intent,evaluate,options){
 const selections=Object.fromEntries(row.acquisition.choices.map(({choice,alternatives})=>[choice.id,alternatives.filter(option=>evaluate(option.value)).map(option=>option.id)]));
 const id=intent.generatedIds[row.step.id];if(typeof id!=='string'||id.length>64)throw Error('Identidade preparada da aquisição indisponível.');
 const plan=prepareProgressionChoice(system,draft,{optionId:row.step.optionId,mode:row.step.mode,selections,id,identityPrefix:id,...options});
 const candidate=structuredClone(draft);applyCharacterChanges(candidate,plan.patches);
 const record=candidate.progressionLedger?.records.find(record=>record.id===id);
 if(!record)throw Error('Aquisição preparada sem proveniência.');
 const reservation=intent.costs.find(cost=>cost.id===row.reserveId);if(row.step.mode!=='narrative'&&(!reservation||record.cost.amount>reservation.reserved))throw Error('Custo da aquisição excede a reserva preparada.');
 const before=readData(system,draft,record.cost.dataId);applyCharacterChanges(draft,plan.patches);
 const after=readData(system,draft,record.cost.dataId);
 return {id,optionId:record.optionId,details:plan.details,...(row.step.mode==='narrative'?{}:{payment:{id:row.reserveId,dataId:record.cost.dataId,label:record.label,mode:'remaining',before:before.value,after:after.value,amount:record.cost.amount}})};
}
