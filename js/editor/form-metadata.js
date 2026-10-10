import {AUTHORING_LABELS} from './authoring-labels.js';
import {ACTION_OPERATIONS} from '../validation/actions.js';
import {COMPONENT_CONTRACTS,ITEM_FIELD_CONTRACTS,CHECK_ALGORITHMS,RECOVERY_CONTRACT,EFFECT_EVENTS} from '../validation/contracts.js';
const s=()=>({type:'string'}),path=()=>({type:'path'});
export const LABELS={id:'ID',name:'Nome',label:'Rótulo',title:'Título',field:'Campo do personagem',type:'Tipo',help:'Ajuda',default:'Valor padrão',formula:'Fórmula',variables:'Variáveis',configFrom:'Configuração no sistema',actionsFrom:'Ações no sistema',options:'Opções',optionsFrom:'Fonte das opções',itemSchema:'Campos dos itens',repeat:'Repetição',characterTemplate:'Template do personagem',formulas:'Fórmulas',checks:'Testes',entryRolls:'Rolagens de entradas',sheetActions:'Ações da ficha',recoveryActions:'Recuperações',effectDefinitions:'Efeitos',sources:'Fontes',operations:'Operações',consumeField:'Preferência de consumo',expression:'Expressão',value:'Valor',mode:'Modo',sourceId:'ID da fonte',algorithm:'Algoritmo',note:'Nota da mesa',historyField:'Campo de histórico',layout:'Disposição',variant:'Variante',schemaVersion:'Versão do documento'};
export const labelFor=key=>LABELS[key] || AUTHORING_LABELS[key] || key;
export function nodeSchema(kind,value={}) {
  value??={};
  if(kind==='package')return {schemaVersion:{type:'integer'}};
  if(kind==='system')return {id:s(),name:s(),description:s(),schemaVersion:{type:'integer'},characterTemplate:{type:'any',label:'Template do personagem'},formulas:{type:'object',values:{type:'string',multiline:true}},diceSteps:{type:'boolean'},diceTray:{type:'boolean'},dieScale:{type:'array',items:{type:'integer'}},...SYSTEM_RULES};
  if(kind==='layout')return {id:s(),name:s(),mode:{type:'string',enum:['sheet','table']},schemaVersion:{type:'integer'},showHeader:{type:'boolean',label:'Mostrar cabeçalho'}};
  if(kind==='tab')return {id:s(),label:s(),variant:s()};
  if(kind==='section')return {id:s(),title:s(),note:s(),notes:{type:'string',label:'Nota (alias existente)'},variant:s(),print:printSchema('section',value)};
  if(kind==='container')return {id:s(),variant:s(),layout:{type:'object',properties:{type:{type:'string',enum:['stack','grid','flex']},gap:{type:'number',enum:[4,8,12,16,24,32]},min:{type:'number',enum:[120,140,160,180,220,260,300]}}},repeat:{type:'object',properties:{source:path()}},print:printSchema('container',value)};
  if(kind==='component')return {type:{type:'string',enum:Object.keys(COMPONENT_CONTRACTS)},...Object.fromEntries(Object.entries(COMPONENT_CONTRACTS[value.type]?.properties || {}).filter(([key,desc])=>!desc.inert && !['extensions','type'].includes(key)).map(([key,desc])=>[key,{...desc,...(NESTED[key] || {}),...(key==='print'?printSchema('component',value):{})}]))};
  return {};
}
export function propertyGroup(key) {if(['label','title','name','note','variant','help','rows','placeholder','alt','layout','print','mode','format','actionLabel','addLabel','emptyLabel','heading','removeLabel','searchLabel','searchPlaceholder','toolbarTitle','defaultOpen','reorderable','summaryFields','itemDetails'].includes(key))return 'Apresentação';if(['formula','variables','roll','override','overrideKey','overrideKeys','disabledWhen','entryAction','rollPreset','rollConfigFrom','creationCost','overflow','recovery','traitSources','configFrom','actionsFrom','historyField','presetsFrom','traitsFrom'].includes(key))return 'Lógica';return 'Dados';}
export function initialValue(desc) {if(Object.hasOwn(desc,'default'))return structuredClone(desc.default);if(desc.enum)return desc.enum[0];return {object:{},array:[],boolean:false,number:0,integer:0,any:''}[desc.type] ?? '';}

const str={type:'string'},num={type:'number'},bool={type:'boolean'},ref={type:'path'},any={type:'any'};
const obj=properties=>({type:'object',properties}),arr=items=>({type:'array',items}),map=values=>({type:'object',values});
const strings=names=>Object.fromEntries(names.split(' ').filter(Boolean).map(key=>[key,str]));
const paths=names=>Object.fromEntries(names.split(' ').filter(Boolean).map(key=>[key,ref]));
const optionSchema={...obj({label:str,value:any}),option:true};
const variable=obj({field:ref,system:ref,traitMaxField:ref,value:num,rollField:ref});variable.exclusive=['field','system','traitMaxField','value','rollField'];
export const NESTED={
  default:any,
  disabledWhen:obj({field:ref,equals:any}),
  options:arr(optionSchema),
  itemSchema:map({type:'object',itemField:true,properties:{type:{type:'string',enum:Object.keys(ITEM_FIELD_CONTRACTS)}}}),
  itemDetails:obj({label:str,fields:arr(str)}),
  variables:map(variable),
  summaryFields:arr(str),textEntryDefaults:map(any),
  overrideKeys:obj({weight:ref,capacity:ref,excess:ref}),
  roll:obj({check:ref,sourceId:ref}),
  print:obj({compact:obj({include:bool,fields:arr(str),presentation:{type:'string',enum:['table','records','cards','inline']}})}),
};
export function resolveSchema(desc,value) {
  if(desc.option && (value===null || typeof value!=='object' || Array.isArray(value)))return {type:'any'};
  if(desc.rollSource)return rollValue;
  if(desc.itemField){if(typeof value==='string')return {type:'string',enum:Object.keys(ITEM_FIELD_CONTRACTS),shorthand:true};return {...desc,properties:{type:{type:'string',enum:Object.keys(ITEM_FIELD_CONTRACTS)},...Object.fromEntries(Object.entries(ITEM_FIELD_CONTRACTS[value?.type] || {}).map(([key,parameter])=>[key,{...parameter,...(NESTED[key] || {})}]))}};}
  return desc;
}
export function descriptorFields(names,type='string'){return Object.fromEntries(names.map(key=>[key,{type}]));}

const en=values=>({type:'string',enum:values});
const rollValue=obj({value:any,field:ref,itemField:ref,formula:ref,variables:map({type:'object',rollSource:true}),overrideKey:ref,resolver:ref,fallback:any});
rollValue.exclusive=['value','field','itemField','formula','resolver'];
const checkVariable=obj({field:ref,system:ref,traitMaxField:ref,value:num});checkVariable.exclusive=['field','system','traitMaxField','value'];
const checkSource=obj({id:str,label:str,field:ref,collection:ref,valueField:ref,formula:ref,overrideKey:ref,variables:map(checkVariable)});checkSource.exclusive=['field','collection','formula'];
const check=obj({algorithm:en(CHECK_ALGORITHMS),sources:arr(checkSource),note:{type:'string',multiline:true},momentumField:ref});
const entryRoll=obj({
  ...strings('buttonLabel title submitLabel noRollMessage help'),
  check:obj({...strings('label toggleLabel expressionLabel modifierLabel'),enabled:bool,expression:rollValue,modifier:rollValue}),
  effect:obj({...strings('label resultLabel buttonLabel'),expression:rollValue}),
  scale:obj({base:rollValue,min:{type:'integer'},max:{type:'integer'},step:{type:'integer',default:1},...strings('label incrementLabel noScaleHelp'),increment:rollValue}),
  resource:obj({field:ref,mode:en(['remaining','used']),...paths('matchField valueField maxField consumeField'),cost:rollValue,...strings('label statusLabel unavailableMessage')}),
  info:arr(obj({label:str,source:rollValue})),
});
const recoveryOp=obj({type:en(RECOVERY_CONTRACT.operations),...paths('field maxField valueField filterField'),value:any,filterValues:arr(any),requireCurrentMin:{type:'integer'},label:str});
const recovery=obj({id:str,...strings('label help confirmLabel unavailableMessage'),healing:obj({...paths('field maxField totalField usedField dieField'),modifier:rollValue,minimum:{type:'integer'},requireCurrentMin:{type:'integer'},label:str}),operations:arr(recoveryOp)});
const actionOp=obj({type:en(ACTION_OPERATIONS),...paths('field maxField valueField filterField sourceField dieField gradeField recoverableField'),value:any,amount:num,min:num,names:arr(str),name:str,steps:{type:'integer'},filterValues:arr(any),requireCurrentMin:{type:'integer'},label:str});
const action=obj({id:str,label:str,note:{type:'string',multiline:true},requirements:arr(obj({field:ref,min:num,equals:any,message:str})),operations:arr(actionOp),effects:arr(actionOp)});
const effect=obj({id:str,label:str,revision:{type:'integer'},stacking:en(['unique']),group:str,applicability:en(['always','confirmEachRoll']),duration:obj({type:en(['manual','untilEvent']),event:en(EFFECT_EVENTS)}),operations:arr(obj({type:en(['add']),value:num,target:obj({kind:en(['calculation','checkModifier']),key:ref,unit:en(['total','bonusDice','dice','action'])})}))});
const budgetSource=obj({field:ref,kind:en(['map','list']),...paths('labelsFrom catalogFrom costsFrom'),baseDie:num,label:str,...strings('valueField costField evolutionValueField'),countCreation:bool,limitByQuality:bool,allowComposite:bool});
const budget=obj({...paths('field qualityField adjustmentField evolutionField presetsFrom'),sources:arr(budgetSource),modifiers:arr(obj({field:ref,valueField:ref,sign:num,label:str})),postAscension:obj({enabledField:ref,formulaFrom:ref})});
const repertoire=obj(paths('specializationsField gradeField techniquesField linkField progressionFrom'));
const technique=obj({...paths('attributesFrom attributesField skillsField techniquesField specializationsField costsFrom energyField concentrationField lastUseField'),skillBaseDie:num,modes:arr(obj({id:str,label:str,terms:arr(en(['attribute','specialization','technique','skill','highestSpecialization','constant'])),requiresTechnique:bool,requiresSpecialization:bool,requiresConcentration:bool,techniqueFrom:en(['specialization']),reductionSteps:{type:'integer'},energyFrom:en(['original','specialization']),reverseOnFailure:bool,failureImpact:bool,free:bool,constantDie:num,defaultAttribute:{type:'string',editor:'attributeKey'},skill:{type:'string',editor:'skillKey'},labels:obj(strings('attribute specialization technique skill highestSpecialization constant')),note:{type:'string',multiline:true}}))});
const poolSource=obj({kind:en(['constant','field','entries']),from:en(['character','system']),id:str,label:str,sides:any,sidesFrom:ref,field:ref,collection:ref,require:ref,excludeWhen:obj({field:ref,equals:any})});
Object.assign(NESTED,{
  creationCost:obj({baseDie:num,valueField:ref,costsFrom:ref}),
  traitSources:arr(poolSource),
  overflow:obj({field:ref,startDie:num,defaultName:str,onFirst:arr(obj({field:ref,value:any})),onLimit:arr(obj({field:ref,value:any}))}),
  recovery:obj({note:{type:'string',multiline:true}}),
  categoriesFrom:{type:'path'},baseDieFrom:{type:'path'},
});
export const SYSTEM_RULES={
  checks:map(check),entryRolls:map(entryRoll),sheetActions:arr(action),recoveryActions:arr(recovery),effectDefinitions:arr(effect),
  pointBudget:budget,repertoire,techniqueUse:technique,
  attributes:arr(obj({key:str,label:str,short:str})),
  qualityPresets:arr(obj({id:str,label:str,points:num,maxDie:num})),
  attributeSetPresets:arr(obj({id:str,label:str,dice:arr(num)})),
  skillCategories:arr(obj({id:str,label:str,skills:arr(str)})),skillBaseDie:num,
  improvementCosts:map(map(num)),energyCostByDie:map(num),carryMultiplier:num,
  techniques:obj({progressionByDie:map(obj({freeCount:{type:'integer'},grants:arr(obj({count:{type:'integer'},sides:num}))}))}),
  abilities:arr(obj({key:str,label:str,short:str})),skills:arr(obj({key:str,label:str,ability:str})),diceSet:arr(num),
  opposition:obj({passivePresets:arr(obj({id:str,label:str,dice:arr(num)}))}),resolution:obj({type:en(['d20-above-difficulty']),difficultyFormula:ref,criticalSuccessAt:num,criticalFailureAt:num,note:{type:'string',multiline:true}}),
  evolution:obj({costs:map(num),postAscensionFormulaOptional:{type:'string',editor:'postAscensionFormula'}}),
};
export function ruleDescriptor(key){return SYSTEM_RULES[key];}

export function printSchema(kind,value){const collection=kind==='component'&&value?.itemSchema;return {type:'object',properties:{compact:{type:'object',properties:{include:{type:'boolean',label:'Incluir na impressão compacta'},...(collection?{fields:{type:'array',items:{type:'string'},label:'Campos no resumo'}}:{}),...(kind!=='component'||collection?{presentation:{type:'string',enum:collection?['table','records']:['cards','inline'],label:'Apresentação compacta'}}:{})}}}};}
