import {structuralNodes,valueAt,destinations,object} from './form-structure.js';
import {generatedKey} from './data-index.js';
import {setValueCommands} from './form-commands.js';
import {pointerFor} from './source-map.js';

// A recipe is a disposable projection of the canonical package, never a session.
export function assistedRecipePlan(pkg,{type,name,destination,config}) {
 if(!String(name||'').trim())throw new Error('Informe o nome mostrado na ficha.');
 if(!destinations(pkg,'component').some(d=>pointerFor(d.path)===pointerFor(destination)))throw new Error('Escolha um grupo válido.');
 const draft=structuredClone(pkg),commands=[],dependencies=[],companions=[];
 const create=(scope,label,value)=>{const parent=scope==='character'?draft.system.characterTemplate:draft.system;
  const key=generatedKey(label,Object.keys(parent));parent[key]=structuredClone(value);
  commands.push(...setValueCommands(pkg,scope==='character'?['system','characterTemplate',key]:['system',key],value));
  dependencies.push((scope==='character'?'Dado: ':'Catálogo/regra: ')+label);return key;};
 const component={type,label:name};
 const scale=config.scale||pkg.system.dieScale;
 const requireScale=()=>{if(!Array.isArray(scale)||!scale.length||scale.some((v,i)=>!Number.isInteger(v)||v<1||(i&&v<=scale[i-1])))throw new Error('Informe uma escala crescente de dados positivos.');if(JSON.stringify(scale)!==JSON.stringify(pkg.system.dieScale)){commands.push(...setValueCommands(pkg,['system','dieScale'],scale));dependencies.push('Escala de dados do sistema: '+scale.map(v=>'d'+v).join(', '));}};
 const collection=(label,rows,schema)=>{const field=create('character',label,rows);companions.push({type:'list',label,field,itemSchema:schema});return field;};
 if(type==='slotTracker') {
  if(!config.rows?.length)throw new Error('Acrescente ao menos um nível de usos.');
  const levels=new Set();for(const row of config.rows){if(!Number.isInteger(row.level)||levels.has(row.level)||!Number.isInteger(row.max)||row.max<0||!Number.isInteger(row.used)||row.used<0||row.used>row.max)throw new Error('Níveis devem ser únicos; usos entre zero e máximo.');levels.add(row.level);}
  component.field=create('character',name,config.rows);component.display=config.display;
  if(config.consumeField)component.consumeField=config.consumeField;
  else if(config.newPreference)component.consumeField=create('character',name+' consumir',config.consume===true);
 } else if(type==='skillCatalog') {
  requireScale();if(!scale.includes(config.baseDie))throw new Error('O dado base deve pertencer à escala.');
  if(!config.categories?.length||config.categories.some(c=>!c.label?.trim()||!c.skills?.length||c.skills.some(n=>!n.trim())))throw new Error('Nomeie categorias e perícias.');
  const names=config.categories.flatMap(c=>c.skills);if(new Set(names).size!==names.length)throw new Error('Cada nome de perícia deve ser único no catálogo.');
  component.field=create('character',name,{});component.baseDieFrom=create('system',name+' dado base',config.baseDie);
  component.categoriesFrom=create('system',name+' categorias',config.categories.map((c,i)=>({...c,id:'categoria_'+(i+1)})));component.allowComposite=config.allowComposite===true;
 } else if(type==='traitAllocation') {
  requireScale();if(!config.traits?.length||config.traits.some(t=>!t.label?.trim()))throw new Error('Nomeie os traços.');
  const keys=[],traits=config.traits.map(t=>{const key=generatedKey(t.label,keys);keys.push(key);return {key,label:t.label};});
  if(!config.presets?.length||config.presets.some(p=>!p.label?.trim()||p.dice.length!==traits.length||p.dice.some(d=>!scale.includes(d))))throw new Error('Cada conjunto precisa de nome e um dado da escala para cada traço.');
  component.field=create('character',name,Object.fromEntries(traits.map(t=>[t.key,config.initialDie])));
  if(!scale.includes(config.initialDie))throw new Error('Escolha o dado inicial na escala.');
  component.traitsFrom=create('system',name+' traços',traits);component.presetsFrom=create('system',name+' conjuntos',config.presets.map((p,i)=>({...p,id:'conjunto_'+(i+1)})));
  for(const t of traits)companions.push({type:'die',label:t.label,field:component.field+'.'+t.key});
 } else if(type==='stateList') {
  requireScale();component.field=create('character',name,[]);component.gradeField='sides';component.itemSchema={name:{type:'text',label:'Nome'},sides:{type:'die',label:'Grau'},recoverable:{type:'boolean',label:'Pode recuperar'}};
  if(config.recovery)component.recovery={};
  if(config.overflow){if(!scale.includes(config.startDie))throw new Error('Escolha o dado inicial do estado vinculado.');const field=collection(config.overflowName,[],component.itemSchema);component.overflow={field,startDie:config.startDie,defaultName:config.overflowName};
   for(const phase of ['onFirst','onLimit'])if(config[phase]?.length)component.overflow[phase]=structuredClone(config[phase]);}
 } else if(type==='inventorySummary') {
  if(config.collection){component.field=config.collection;for(const key of ['weightField','quantityField','strengthField','multiplierField']){if(!config[key])throw new Error('Escolha todas as fontes de carga.');component[key]=config[key];}if(config.carriedField)component.carriedField=config.carriedField;}
  else {for(const key of ['strength','multiplier'])if(!Number.isFinite(config[key])||config[key]<0)throw new Error('Informe capacidade e multiplicador não negativos.');
   component.field=collection(name+' itens',[],{name:{type:'text',label:'Nome'},weight:{type:'number',label:'Peso'},quantity:{type:'number',label:'Quantidade'},carried:{type:'boolean',label:'Carregado',default:true}});
   component.weightField='weight';component.quantityField='quantity';component.carriedField='carried';
   component.strengthField=create('character',name+' capacidade base',config.strength);component.multiplierField=create('character',name+' multiplicador',config.multiplier);
   companions.push({type:'number',label:'Capacidade base',field:component.strengthField},{type:'number',label:'Multiplicador de carga',field:component.multiplierField});}
 } else throw new Error('Receita assistida desconhecida.');
 const index=valueAt(pkg,destination).length;
 for(const [i,value] of [component,...companions].entries())commands.push({type:'insertNode',path:destination,index:index+i,value});
 dependencies.push('Todos os controles compartilham os dados do pacote; inclusão e dependências formam um único desfazer.');
 return {commands,selection:[...destination,index],dependencies};
}
