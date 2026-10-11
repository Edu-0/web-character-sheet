// Typed values are independent of their visual consumers. No coercion or defaults on read.
export const DATA_TYPES = Object.freeze(['string','number','integer','boolean','enum','trait','record','collection','reference']);
export const DATA_LIMITS = Object.freeze({definitions:500,depth:8,entries:1000,fields:64,traitDice:8});
export const safeDataId = value => typeof value==='string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);
export const recordValue = value => value!==null && typeof value==='object' && !Array.isArray(value);
const orderedValue=value=>Array.isArray(value)?value.map(orderedValue):recordValue(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,orderedValue(value[key])])):value;

export function typedValueIssue(definition,value,{allowInitial=false,depth=0}={}) {
  if(depth>DATA_LIMITS.depth)return 'profundidade de dado excedida';
  if(value===null)return definition.nullable?null:'null não permitido';
  const {type}=definition;
  if(type==='number' || type==='integer') {
    if(type==='integer'?!Number.isSafeInteger(value):typeof value!=='number'||!Number.isFinite(value))return `valor incompatível com ${type}`;
    if(definition.minimum!==undefined && value<definition.minimum)return 'valor abaixo do mínimo';
    if(definition.maximum!==undefined && value>definition.maximum)return 'valor acima do máximo';
  } else if(type==='string') {
    if(typeof value!=='string')return 'valor incompatível com string';
    if(definition.maxLength!==undefined && value.length>definition.maxLength)return 'texto excede tamanho permitido';
  } else if(type==='boolean') {if(typeof value!=='boolean')return 'valor incompatível com boolean';}
  else if(type==='enum') {if(typeof value!=='string' || !definition.options?.some(o=>o.id===value))return 'opção inexistente';}
  else if(type==='trait') {
    if(!Array.isArray(value)||!value.length||value.length>DATA_LIMITS.traitDice||(!definition.composite&&value.length!==1)||value.some(d=>!definition.scale?.includes(d)))return 'traço exige dados da escala declarada';
  } else if(type==='reference') {
    if(definition.multiple){if(!Array.isArray(value)||value.length>DATA_LIMITS.entries||value.some(v=>!safeDataId(v))||new Set(value).size!==value.length)return 'referências devem ter identidades únicas';}
    else if(!safeDataId(value))return 'referência exige identidade';
  } else if(type==='record' || type==='collection') {
    if(type==='record' && !recordValue(value))return 'registro deve ser objeto';
    if(type==='collection' && (!Array.isArray(value)||value.length>Math.min(definition.maxItems??DATA_LIMITS.entries,DATA_LIMITS.entries)||value.length<(definition.minItems??0)))return 'cardinalidade da coleção inválida';
    const entries=type==='collection'?value:[value],ids=new Set();
    for(const entry of entries){
      if(!recordValue(entry))return 'entrada deve ser registro';
      if(type==='collection'){if(!safeDataId(entry.id)||ids.has(entry.id))return 'identidade de entrada ausente ou duplicada';ids.add(entry.id);}
      for(const field of definition.fields||[]) {
        if(!Object.hasOwn(entry,field.binding)){if(field.required && !(allowInitial&&Object.hasOwn(field,'initial')))return `${field.label}: dado obrigatório ausente`;continue;}
        const issue=typedValueIssue(field,entry[field.binding],{allowInitial,depth:depth+1});if(issue)return `${field.label}: ${issue}`;
      }
    }
    for(const fieldId of definition.unique||[]){const field=definition.fields?.find(f=>f.id===fieldId);if(!field)return 'campo de unicidade inexistente';const values=entries.filter(e=>Object.hasOwn(e,field.binding)).map(e=>JSON.stringify(orderedValue(e[field.binding])));if(new Set(values).size!==values.length)return `${field.label}: valor duplicado`;}
  } else return `valor incompatível com ${type}`;
  return null;
}

export function initialRecord(definition,{entry=false}={}) {
  const value=entry?{id:'entry-'+crypto.randomUUID()}:{};
  for(const field of definition.fields||[])if(Object.hasOwn(field,'initial'))value[field.binding]=initializeStructuredValue(field,structuredClone(field.initial));
  return value;
}
export function initializeStructuredValue(definition,value) {
  if(value===null)return value;
  if(definition.type==='record'){
    const defaults=initialRecord(definition);for(const [key,initial]of Object.entries(defaults))if(!Object.hasOwn(value,key))value[key]=initial;
    for(const f of definition.fields||[])if(Object.hasOwn(value,f.binding))value[f.binding]=initializeStructuredValue(f,value[f.binding]);
  } else if(definition.type==='collection')for(const entry of value) {
    const defaults=initialRecord(definition);for(const [key,initial]of Object.entries(defaults))if(!Object.hasOwn(entry,key))entry[key]=initial;
    for(const f of definition.fields||[])if(Object.hasOwn(entry,f.binding))entry[f.binding]=initializeStructuredValue(f,entry[f.binding]);
  }
  return value;
}
