import {expandComponents} from '../engine/layout-components.js';
import {getByPath} from '../engine/paths.js';
import {computedKey} from '../engine/computed-values.js';

export function validateRollReferences(pkg, character = pkg.system.characterTemplate) {
  const issues=[], components=[];
  const add=(path,message)=>issues.push({path,message,code:'roll.reference'});
  for(const [li,layout] of pkg.layouts.entries()) for(const [ti,tab] of (layout.tabs || []).entries()) for(const [si,section] of (tab.sections || []).entries()) for(const [ci,container] of (section.containers || []).entries()) {
    for(const [index,component] of expandComponents(container,pkg.system).entries()) components.push({component,layout,path:`package.layouts[${li}].tabs[${ti}].sections[${si}].containers[${ci}].components[${index % container.components.length}].roll`});
  }
  const equivalent=(source,component)=>component.type==='computed' && component.mode!=='roll' && component.override!==false && computedKey(source)===computedKey(component) && source.formula===component.formula && JSON.stringify(source.variables || {})===JSON.stringify(component.variables || {});
  for(const [key,config] of Object.entries(pkg.system.checks || {})) for(const [index,source] of config.sources.entries()) {
    if((source.overrideKey || source.variables) && !components.some(({component})=>equivalent(source,component))) add(`system.checks.${key}.sources[${index}]`,'fórmula/variáveis/chave sem cálculo compatível nos layouts');
  }
  for(const {component,layout,path} of components) {
    if(component.roll===undefined) continue;
    const roll=component.roll;
    if(layout.schemaVersion<2) add(path,'botão de teste exige layout versão 2');
    if(!roll || typeof roll!=='object' || Array.isArray(roll)) {add(path,'exige objeto');continue;}
    if(!['number','counter','die','computed','list'].includes(component.type)) add(path,'tipo de componente incompatível com botão de teste');
    const source=pkg.system.checks?.[roll.check]?.sources.find(source=>source.id===roll.sourceId);
    if(typeof roll.check!=='string' || typeof roll.sourceId!=='string' || !source) {add(path,'teste/fonte com ID explícito inexistente');continue;}
    if(component.type==='list') {
      if(source.collection!==component.field || !['number','die'].includes(typeof component.itemSchema?.[source.valueField]==='string' ? component.itemSchema[source.valueField] : component.itemSchema?.[source.valueField]?.type)) add(path,'coleção/campo da fonte deve corresponder à lista numérica');
      for(const [i,item] of (getByPath(character,component.field) || []).entries()) if(!item?.id) issues.push({path:`${character===pkg.system.characterTemplate?'system.characterTemplate':'character'}.${component.field}[${i}].id`,message:'botão indisponível em entrada legada sem identidade; dados preservados',code:'roll.identity',severity:character===pkg.system.characterTemplate?'error':'warning'});
    } else if(component.type==='computed' ? !equivalent(source,component) : source.field!==component.field) add(path,'fonte deve corresponder ao campo/cálculo apresentado');
  }
  return issues;
}
