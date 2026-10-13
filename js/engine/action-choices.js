// Choices consume the same admitted expressions and return a disposable selection plan.
import {compileActionExpression} from './action-expression.js';
import {sameRuleType} from './rule-analysis.js';
import {safeDataId} from './data-types.js';
export const CHOICE_LIMITS=Object.freeze({steps:32,options:100});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateActionSelections(selections,ids){
 if(!object(selections)||Object.keys(selections).length>CHOICE_LIMITS.steps||Object.entries(selections).some(([id,value])=>!safeDataId(id)||!safeDataId(value)||ids&&!ids.has(id)))throw Error('Escolha desconhecida ou identidade inválida.');return selections;
}
export function compileActionChoice(system,step,scope){
 if(Object.keys(step).some(key=>!['id','label','type','source','fieldId','when','otherwise'].includes(key)))throw Error('Parâmetro de escolha indisponível.');
 const source=compileActionExpression(system,step.source,'collection',scope);if(!source.type.item?.collectionEntry)throw Error('Escolha exige entradas de coleção.');const field=source.type.definition.fields?.find(field=>field.id===step.fieldId);if(!field||!['string','number','integer','boolean','enum'].includes(field.type))throw Error('Escolha um campo simples para identificar as entradas.');
 const when=step.when?compileActionExpression(system,step.when,'boolean',scope):null;let otherwise;if(when&&!step.otherwise)throw Error('Escolha condicional exige alternativa de registro.');if(step.otherwise){otherwise=compileActionExpression(system,step.otherwise,'record',scope);if(!when||!sameRuleType(source.type.item,otherwise.type))throw Error('Alternativa da escolha exige registro da mesma coleção.');}
 const ids=new Set(source.compiled.index.get(source.ruleId).nodes.keys()),unique=prefix=>{let id=prefix;while(ids.has(id))id+='_';ids.add(id);return id;},key={id:unique('choice_key'),op:'literal',version:1,value:'selected-entry'},lookup={id:unique('choice_lookup'),op:'lookup',version:1,source:structuredClone(step.source),key};
 compileActionExpression(system,lookup,'record',scope); // Admit wrapper size and types before any RNG.
 return {step,choice:{source,field,when,otherwise,select:id=>{const expression=structuredClone(lookup);expression.key.value=id;return compileActionExpression(system,expression,'record',scope);}},valueType:{...source.type.item,optional:false,nullable:false}};
}
export function evaluateActionChoice(row,evaluate,selections){
 const {step,choice}=row;if(choice.when&&!evaluate(choice.when)){if(Object.hasOwn(selections,step.id))throw Error('Escolha não se aplica a este ramo.');return {value:evaluate(choice.otherwise,step.id)};}
 const entries=evaluate(choice.source);if(!Array.isArray(entries)||!entries.length)throw Error('Nenhuma entrada disponível para '+step.label+'.');if(entries.length>CHOICE_LIMITS.options)throw Error('Escolha excede limite de entradas.');
 const ids=new Set();for(const entry of entries){if(!safeDataId(entry?.id)||ids.has(entry.id))throw Error('Identidade de entrada ausente ou duplicada.');ids.add(entry.id);}
 if(!Object.hasOwn(selections,step.id))return {pending:{id:step.id,label:step.label,options:entries.map(entry=>{const value=entry[choice.field.binding];return {id:entry.id,label:(value===undefined?'Não informado':choice.field.type==='enum'?choice.field.options.find(option=>option.id===value)?.label:value===true?'Sim':value===false?'Não':String(value)).slice(0,160)};})}};
 if(!ids.has(selections[step.id]))throw Error('Entrada escolhida indisponível.');return {value:evaluate(choice.select(selections[step.id]),step.id)};
}
