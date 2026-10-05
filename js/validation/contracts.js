// Descritores consumidos pelo validador e pela referência gerada. Sem dados de livros.
import {pathKeys} from '../engine/paths.js';
export const CHECK_ALGORITHMS = ['fate','percentile','d6Pool','d6Resistance','explodingTrait','explodingDamage','challenge','progress'];
export const CHECK_UNITS = Object.freeze({fate:'total',percentile:'bonusDice',d6Pool:'dice',d6Resistance:'dice',explodingTrait:'total',explodingDamage:'total',challenge:'action'});
export const EFFECT_EVENTS = ['endRound','endScene'];
export const EFFECT_LIMITS = Object.freeze({definitions:100,instances:100,operations:20,value:1000});
export const RUNTIME_DEFAULTS = Object.freeze({historyLimit:20,textareaRows:3,counterMin:0,checkEnabled:true,scaleStep:1});
export const ROLL_OPTION_ALIASES = [['testEnabled','checkEnabled'],['attack','checkEnabled'],['testExpression','checkExpression'],['attackModifier','modifier'],['upcast','increment']];
export const CHECK_CONTRACT = {fields:['algorithm','sources','note','momentumField','extensions'],sourceFields:['id','label','field','collection','valueField','formula','overrideKey','variables','extensions'],variableFields:['field','system','traitMaxField','value','extensions'],maxSources:100,maxVariables:32};
export const ENTRY_ROLL_CONTRACT = {
  fields:['buttonLabel','title','submitLabel','noRollMessage','help','check','test','effect','scale','resource','info'],
  source:['value','field','itemField','formula','variables','overrideKey','resolver','fallback'],
  check:['label','toggleLabel','expressionLabel','modifierLabel','enabled','expression','modifier'],
  effect:['label','resultLabel','buttonLabel','expression'],
  scale:['base','min','max','step','label','incrementLabel','increment','noScaleHelp'],
  resource:['field','mode','matchField','valueField','maxField','cost','label','statusLabel','unavailableMessage','consumeField'],
  info:['label','source'],resourceModes:['remaining','used'],
  options:['checkEnabled','checkExpression','testEnabled','testExpression','modifier','effect','increment','attack','attackModifier','upcast'],
};
export const RECOVERY_CONTRACT = {
  fields:['id','label','help','confirmLabel','unavailableMessage','healing','operations'],
  healing:['field','maxField','totalField','usedField','dieField','modifier','minimum','requireCurrentMin','label'],
  operation:['type','field','maxField','value','valueField','filterField','filterValues','requireCurrentMin','label'],
  operations:['restoreValue','set','restoreCollection','setCollection'],maxActions:30,
};

const p = (type, options = {}) => ({type,...options});
const fields = (names, type = 'string') => Object.fromEntries(names.split(' ').filter(Boolean).map(name=>[name,p(type)]));
export const COMMON_COMPONENT_PROPERTIES = {
  type:p('string',{required:true}),label:p('string'),field:p('path'),variant:p('string'),help:p('string'),default:p('any'),
  disabledWhen:p('object',{semantic:'field/equals; bloqueia controles, sem apagar dados'}),print:p('object',{semantic:'perfil compact; validação em schemas.js'}),extensions:p('any'),
};
const calculation = {override:p('boolean'),overrideKey:p('path'),stepControls:p('boolean')};
const collection = {itemSchema:p('object'),itemDetails:p('object'),...fields('addLabel emptyLabel heading summaryFields'),
  summaryFields:p('array'),toolbarTitle:p('boolean'),fixedLength:p('integer'),defaultOpen:p('boolean'),reorderable:p('boolean'),
  textEntryField:p('string'),textEntryDefaults:p('object'),creationCost:p('object')};
const roll = {roll:p('object',{semantic:'check/sourceId; referências em roll-references.js; opt-in'})};
function component(source, summary, field, properties = {}, semantic = 'schemas.js') {
  return {source,summary,semantic,properties:{...COMMON_COMPONENT_PROPERTIES,...properties,...(field?{field:p('path',{required:true})}:{})}};
}
const basic='js/engine/fields.js',advanced='js/engine/advanced-fields.js',assisted='js/engine/assisted-fields.js',dnd='js/systems/dnd2024-fields.js';
export const COMPONENT_CONTRACTS = {
  boolean:component(basic,'Escolha booleana',true),
  number:component(basic,'Número preenchível; min/max legados não limitam este input',true,{...roll,min:p('number',{inert:true}),max:p('number',{inert:true})}),
  text:component(basic,'Texto curto',true,{placeholder:p('string')}),
  textarea:component(basic,'Texto longo',true,{rows:p('integer',{default:RUNTIME_DEFAULTS.textareaRows})}),
  select:component(basic,'Uma opção; optionsFrom é expandido pelo layout; presentation/valueType só atuam em itemSchema',true,{options:p('array'),optionsFrom:p('path'),presentation:p('string',{inert:true}),valueType:p('string',{inert:true})}),
  resource:component(basic,'Objeto current/max; edição não cobra evolução',true),
  counter:component(basic,'Contador com limites nos botões',true,{...roll,min:p('number',{default:RUNTIME_DEFAULTS.counterMin}),max:p('number')}),
  die:component(basic,'Traço por escala; degraus existentes independentes de efeitos temporários',true,{...calculation,...roll,allowComposite:p('boolean')}),
  image:component(advanced,'Imagem local segura',true,{alt:p('string')}),
  tagList:component(advanced,'Lista de textos',true,{placeholder:p('string')}),
  list:component(advanced,'Coleção de registros com identidade',true,{...collection,...roll,entryAction:p('string',{enum:['roll','dndSpell','dndAttack']}),rollPreset:p('path'),rollConfigFrom:p('path',{alias:'rollPreset'})},'schemas.js / roll-references.js / entry-rolls.js'),
  table:component(advanced,'Coleção tabular',true,{...collection,...fields('removeLabel searchLabel searchPlaceholder'),searchable:p('boolean')}),
  stateList:component(advanced,'Estados graduados autorais existentes; não é activeEffects',true,{...collection,gradeField:p('string'),effectLabel:p('string'),overflow:p('object'),recovery:p('object')}),
  skillCatalog:component(advanced,'Catálogo configurado de perícias',true,{...calculation,...fields('baseDieFrom categoriesFrom doneLabel editLabel emptyLabel'),allowComposite:p('boolean')}),
  slotTracker:component(advanced,'Usos/limites compartilhados; display só altera apresentação',true,{...fields('consumeLabel levelLabel'),consumeField:p('path'),display:p('string',{enum:['used','remaining'],default:'used'})}),
  computed:component(advanced,'Cálculo nomeado; modo roll não recebe override/efeito derivado',false,{...calculation,...roll,formula:p('path',{required:true}),variables:p('object'),mode:p('string',{enum:['roll']}),format:p('string'),actionLabel:p('string')},'schemas.js / references.js / roll-references.js'),
  poolBuilder:component(advanced,'Pool autoral e oposição assistida',false,{traitSources:p('array'),...fields('rollLabel resolveLabel')}),
  pointBudget:component('js/engine/point-fields.js','Criação e evolução paga/narrativa separadas',false,{configFrom:p('path',{default:'pointBudget'})}),
  traitAllocation:component(assisted,'Distribuição de traços conforme configuração',true,{presetsFrom:p('path',{required:true}),traitsFrom:p('path',{required:true})}),
  inventorySummary:component(assisted,'Peso/capacidade/excesso derivados',true,{...calculation,overrideKeys:p('object'),...Object.fromEntries(['weightField','quantityField','strengthField','multiplierField'].map(key=>[key,p('path',{required:true})])),carriedField:p('path')}),
  repertoire:component(assisted,'Repertório configurado',false,{configFrom:p('path',{required:true})}),
  actionGroup:component(assisted,'Comandos confirmados com histórico específico',false,{actionsFrom:p('path',{required:true}),historyField:p('path',{default:'scene.lastAction'}),note:p('string')}),
  recoveryGroup:component('js/engine/recovery-fields.js','Prévia/condições confirmadas de recuperação',false,{actionsFrom:p('path',{required:true}),historyField:p('path',{required:true})},'schemas.js / recovery.js'),
  techniqueUse:component('js/engine/technique-fields.js','Uso assistido autoral; não converte para checkRoll',false,{configFrom:p('path',{required:true})}),
  checkRoll:component('js/engine/check-fields.js','Teste sem mutação, com decisões manuais',false,{configFrom:p('path',{required:true})},'schemas.js / checks.js'),
  effectList:component('js/engine/effect-fields.js','Instâncias/ativação/eventos/remoção de efeitos v2',false,{},'schemas.js / effects.js'),
  dndAbility:component(dnd,'Atributo D&D e seus derivados',true,{...fields('key short'),...calculation}),
  dndSkill:component(dnd,'Perícia D&D e proficiência',true,{...fields('key ability'),...calculation}),
  dndDerived:component(dnd,'Derivado D&D com chave estável',false,{stat:p('string'),...calculation}),
};
export const ITEM_FIELD_CONTRACTS = Object.fromEntries(['text','textarea','number','boolean','select','die','reference'].map(type=>[type,{
  ...fields('label help placeholder'),default:p('any'),...(type==='textarea'?{rows:p('integer',{default:RUNTIME_DEFAULTS.textareaRows})}:{}),
  ...(type==='die'?{allowComposite:p('boolean'),stepControls:p('boolean')}:{}),
  ...(['select','reference'].includes(type)?{options:p('array'),optionsFrom:p('path'),valueField:p('string'),labelField:p('string'),valueType:p('string'),multiple:p('boolean'),presentation:p('string',{enum:['checkboxes']})}:{}),
}]));

export function validateComponentShape(component, path, issues) {
  const contract=COMPONENT_CONTRACTS[component.type];if(!contract) return;
  validateParameterShape(component,contract.properties,path,issues);
}
export function validateParameterShape(document,properties,path,issues) {
  for(const [key,parameter] of Object.entries(properties)) {
    const value=document[key];
    if(value===undefined) {if(parameter.required) issues.push({path:`${path}.${key}`,message:'parâmetro obrigatório',code:'component.required'});continue;}
    if(parameter.inert || parameter.type==='any') continue;
    const valid=parameter.type==='array' ? Array.isArray(value) : parameter.type==='object' ? value!==null && typeof value==='object' && !Array.isArray(value)
      : parameter.type==='integer' ? Number.isSafeInteger(value) : parameter.type==='number' ? Number.isFinite(value)
      : ['path','string'].includes(parameter.type) ? typeof value==='string' : typeof value===parameter.type;
    if(!valid || parameter.enum && !parameter.enum.includes(value)) issues.push({path:`${path}.${key}`,message:`parâmetro incompatível (${parameter.type}${parameter.enum?`; ${parameter.enum.join(', ')}`:''})`,code:'component.parameter'});
    if(valid && parameter.type==='path') try{pathKeys(value,{template:true});}catch(error){issues.push({path:`${path}.${key}`,message:error.message,code:'component.path'});}
  }
}
