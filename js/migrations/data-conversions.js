// Pure, bounded data conversions for an explicitly reviewed migration.
// These do not execute RPG rules, initialize a character or write storage.
export const DATA_CONVERSIONS=Object.freeze(['copy','text','number','integer','boolean','map','split','join']);
const clone=value=>structuredClone(value),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const decimal=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const optionsFor={copy:[],text:[],number:[],integer:['rounding'],boolean:['trueValue','falseValue'],map:['pairs','unmapped','each'],split:['separator','index'],join:['separator']};
function numeric(value){
 if(typeof value==='string'){if(!decimal.test(value))throw Error('Texto numérico completo exigido; vazio não significa zero.');value=Number(value);}
 if(typeof value!=='number'||!Number.isFinite(value))throw Error('Número finito exigido; null e Sim/Não não são números.');return value;
}
export function validateConversion(kind,options={}){
 if(!DATA_CONVERSIONS.includes(kind)||!object(options)||Object.keys(options).some(key=>!optionsFor[kind].includes(key)))throw Error('Conversão ou parâmetro não permitido.');
 if(kind==='integer'&&!['exact','floor','ceil','round','truncate'].includes(options.rounding??'exact'))throw Error('Escolha uma política de arredondamento permitida.');
 if(kind==='boolean'){
  const yes=options.trueValue??'true',no=options.falseValue??'false';if(typeof yes!=='string'||typeof no!=='string'||yes===no)throw Error('Valores distintos de texto para Sim e Não exigidos.');
 }
 if(kind==='map'){
  if(!Array.isArray(options.pairs)||!options.pairs.length||options.pairs.length>1000||options.pairs.some(pair=>!object(pair)||!Object.hasOwn(pair,'from')||!Object.hasOwn(pair,'to')||Object.keys(pair).some(key=>!['from','to'].includes(key))))throw Error('Mapa exige até mil pares explícitos de origem e destino.');
  if(new Set(options.pairs.map(pair=>JSON.stringify(pair.from))).size!==options.pairs.length)throw Error('Origem duplicada no mapa de conversão.');
  if(!['block','keep'].includes(options.unmapped??'block')||options.each!==undefined&&typeof options.each!=='boolean')throw Error('Política de mapa inválida.');
 }
 if(['split','join'].includes(kind)){
  if(typeof options.separator!=='string'||options.separator.length>100||kind==='split'&&!options.separator.length)throw Error('Separador de texto explícito exigido.');
  if(kind==='split'&&(!Number.isSafeInteger(options.index)||options.index<0||options.index>63))throw Error('Parte de texto entre zero e63 exigida.');
 }
 return true;
}
export function convertDataCells(kind,cells,options={}){
 validateConversion(kind,options);
 if(!Array.isArray(cells)||!cells.length||cells.length>64||cells.some(cell=>!object(cell)||typeof cell.present!=='boolean'||cell.present&&!Object.hasOwn(cell,'value'))||kind!=='join'&&cells.length!==1)throw Error('Fontes da conversão inválidas.');
 if(kind==='join'){
  if(cells.some(cell=>!cell.present||typeof cell.value!=='string'))throw Error('Juntar exige todas as fontes presentes e de texto; ausência e null não viram vazio.');
  return {present:true,value:cells.map(cell=>cell.value).join(options.separator)};
 }
 const cell=cells[0];if(!cell.present)return {present:false};let value=cell.value;
 if(kind==='copy')return {present:true,value:clone(value)};
 if(kind==='text'){
  if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('Converter em texto exige texto, número ou Sim/Não; null permanece distinto.');value=String(value);
 }else if(kind==='number')value=numeric(value);
 else if(kind==='integer'){
  value=numeric(value);const rounding=options.rounding??'exact';if(rounding!=='exact')value=({floor:Math.floor,ceil:Math.ceil,round:Math.round,truncate:Math.trunc})[rounding](value);if(!Number.isSafeInteger(value))throw Error('Inteiro seguro exigido; escolha arredondamento para uma fração.');
 }else if(kind==='boolean'){
  if(typeof value!=='boolean'){if(value===(options.trueValue??'true'))value=true;else if(value===(options.falseValue??'false'))value=false;else throw Error('Valor não corresponde ao Sim ou Não declarado.');}
 }else if(kind==='map'){
  const mapped=source=>{const pair=options.pairs.find(pair=>equal(pair.from,source));if(pair)return clone(pair.to);if(options.unmapped==='keep')return clone(source);throw Error('Valor sem correspondência explícita no mapa.');};
  if(options.each){if(!Array.isArray(value)||value.length>1000)throw Error('Mapa por identidade exige uma lista limitada.');value=value.map(mapped);}else value=mapped(value);
 }else if(kind==='split'){
  if(typeof value!=='string')throw Error('Dividir exige texto; null não vira vazio.');const parts=value.split(options.separator);if(parts.length>64||options.index>=parts.length)throw Error('Parte inexistente ou texto com mais de64 partes.');value=parts[options.index];
 }
 return {present:true,value};
}
