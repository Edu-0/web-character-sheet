import { getByPath, pathKeys } from '../engine/paths.js';
import { expandComponents } from '../engine/layout-components.js';

export function checkSourcePath(system, source) {
  let values = [system];
  for (const segment of pathKeys(source.replace(/^system\./,''),{source:true})) {
    const key = segment.replace(/\[\]$/, '');
    if (values.some(value => !value || !Object.hasOwn(Object(value),key))) return false;
    values = values.flatMap(value => segment.endsWith('[]') ? (Array.isArray(value[key]) ? value[key] : []) : [value[key]]);
  }
  return true; // Uma coleção vazia é existente.
}

export function validateReferences(pkg, character, {template = false} = {}) {
  const issues = [], calculations = new Map();
  const add = (path,message,code='reference.invalid',severity='error')=>issues.push({path,message,code,severity});
  const system = pkg.system;
  const characterRoot=template?'system.characterTemplate':'character';
  const read = (root,path)=>{try{return getByPath(root,path);}catch{return undefined;}};
  for (const [li,layout] of pkg.layouts.entries()) for (const [ti,tab] of (layout.tabs || []).entries()) for (const [si,section] of (tab.sections || []).entries()) for (const [ci,container] of (section.containers || []).entries()) {
    const path = `package.layouts[${li}].tabs[${ti}].sections[${si}].containers[${ci}]`;
    if (container.repeat?.source) {
      try {if(!checkSourcePath(system,container.repeat.source)) add(`${path}.repeat.source`,'catálogo inexistente no sistema','reference.missing');}
      catch(error){add(`${path}.repeat.source`,error.message);}
    }
    let components;
    try {components=expandComponents(container,system);} catch {continue;}
    for (const [i,component] of components.entries()) {
      const at=`${path}.components[${i % container.components.length}]`;
      for(const key of ['presetsFrom','traitsFrom']) if(component[key] && read(system,component[key])===undefined) add(`${at}.${key}`,'configuração inexistente no sistema','reference.missing');
      if(component.variables) for(const [key,source] of Object.entries(component.variables)) {
        if(!source || typeof source!=='object') {add(`${at}.variables.${key}`,'fonte deve ser objeto');continue;}
        for(const prop of ['field','traitMaxField','rollField','system']) if(source[prop]) {
          try{pathKeys(source[prop]);}catch(error){add(`${at}.variables.${key}.${prop}`,error.message);}
          if(prop==='system' && read(system,source.system)===undefined) add(`${at}.variables.${key}.system`,'valor inexistente no sistema','reference.missing');
        }
      }
      if (component.optionsFrom && !checkSourcePath(system,component.optionsFrom)) add(`${at}.optionsFrom`,'catálogo inexistente no sistema','reference.missing');
      if (component.disabledWhen) {
        try {pathKeys(component.disabledWhen.field);}catch(error){add(`${at}.disabledWhen.field`,error.message);}
        if (!Object.hasOwn(component.disabledWhen,'equals')) add(`${at}.disabledWhen.equals`,'informe o valor de comparação');
      }
      if (component.type==='computed' && component.mode!=='roll') {
        const key=`computed.${component.overrideKey || component.formula}`;
        const signature=JSON.stringify([component.formula,component.variables || {}]);
        if (calculations.has(key) && calculations.get(key)!==signature) add(`${at}.overrideKey`,`a chave ${key} é compartilhada por cálculos incompatíveis`,'calculation.collision');
        calculations.set(key,signature);
      }
      const entries=read(character,component.field);
      if (Array.isArray(entries) && component.itemSchema) {
        const ids=new Set();
        entries.forEach((entry,index)=>{
          if (entry?.id!==undefined) {
            if(typeof entry.id!=='string' || !entry.id || ids.has(entry.id)) add(`${characterRoot}.${component.field}[${index}].id`,'ID textual não vazio e único obrigatório');
            ids.add(entry.id);
          }
          for(const [key,definition] of Object.entries(component.itemSchema)) if(definition?.type==='reference' && definition.optionsFrom) {
            const [scope,...segments]=definition.optionsFrom.split('.');
            const targets=read(scope==='character'?character:system,segments.join('.'));
            if(!Array.isArray(targets)) {add(`${at}.itemSchema.${key}.optionsFrom`,'coleção de referência inexistente');continue;}
            const values=definition.multiple ? entry?.[key] : [entry?.[key]];
            if(!Array.isArray(values)) {add(`${characterRoot}.${component.field}[${index}].${key}`,'deve ser lista de referências');continue;}
            for(const value of values) if(value!==undefined && value!==null && value!=='' && !targets.some(target=>read(target,definition.valueField || 'id')===value)) add(`${characterRoot}.${component.field}[${index}].${key}`,'referência removida ou inexistente; valor preservado','reference.dangling',template?'error':'warning');
          }
        });
      }
    }
  }
  return issues;
}
