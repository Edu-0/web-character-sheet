import {CHECK_CONTRACT} from './contracts.js';
import { CHECK_ALGORITHMS } from '../engine/checks.js';
import { pathKeys, getByPath } from '../engine/paths.js';

export function validateChecks(checks, issues, system) {
  const issue = (path, message) => issues.push({ path, message, code: 'invalid' });
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) { issue('system.checks', 'deve ser objeto'); return; }
  for (const [key, config] of Object.entries(checks)) {
    const path = `system.checks.${key}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) issue(path, 'nome de teste deve ser um identificador simples');
    if (!config || typeof config !== 'object' || Array.isArray(config)) { issue(path, 'deve ser objeto'); continue; }
    for (const key of Object.keys(config)) if (!CHECK_CONTRACT.fields.includes(key)) issue(`${path}.${key}`, 'opção desconhecida');
    if (!CHECK_ALGORITHMS.includes(config.algorithm)) issue(`${path}.algorithm`, 'algoritmo desconhecido');
    if (config.momentumField !== undefined) {
      if (config.algorithm !== 'challenge') issue(`${path}.momentumField`, 'somente challenge usa ímpeto');
      try { pathKeys(config.momentumField); } catch (error) { issue(`${path}.momentumField`, error.message); }
    }
    if (typeof config.note !== 'string' || !config.note.trim()) issue(`${path}.note`, 'explique as decisões manuais');
    if (!Array.isArray(config.sources) || !config.sources.length || config.sources.length > CHECK_CONTRACT.maxSources) { issue(`${path}.sources`, 'use 1–100 fontes'); continue; }
    const ids = new Set();
    config.sources.forEach((source, i) => {
      const at = `${path}.sources[${i}]`;
      if (!source || typeof source !== 'object' || Array.isArray(source)) { issue(at, 'deve ser objeto'); return; }
      for (const key of Object.keys(source)) if (!CHECK_CONTRACT.sourceFields.includes(key)) issue(`${at}.${key}`, 'opção desconhecida');
      if (source.id !== undefined) {
        if (typeof source.id !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(source.id) || ids.has(source.id)) issue(`${at}.id`,'exige ID simples e único iniciado por letra');
        ids.add(source.id);
      }
      if (source.overrideKey !== undefined) {
        if (!source.formula) issue(`${at}.overrideKey`,'exige formula');
        try {pathKeys(source.overrideKey);} catch(error) {issue(`${at}.overrideKey`,error.message);}
      }
      if (source.variables !== undefined) {
        if (!source.formula) issue(`${at}.variables`,'exige formula');
        if (!source.variables || typeof source.variables !== 'object' || Array.isArray(source.variables) || Object.keys(source.variables).length>CHECK_CONTRACT.maxVariables) issue(`${at}.variables`,'use objeto com até 32 variáveis');
        else for (const [key,definition] of Object.entries(source.variables)) {
          const path=`${at}.variables.${key}`;
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) issue(path,'nome de variável inválido');
          if (!definition || typeof definition!=='object' || Array.isArray(definition)) {issue(path,'exige fonte');continue;}
          const origins=['field','system','traitMaxField','value'].filter(key=>Object.hasOwn(definition,key));
          if(origins.length!==1) issue(path,'use field, system, traitMaxField ou value exclusivamente');
          for(const prop of Object.keys(definition)) if(!CHECK_CONTRACT.variableFields.includes(prop)) issue(`${path}.${prop}`,'opção desconhecida');
          for(const prop of origins) if(prop==='value') {if(!Number.isFinite(definition.value)) issue(`${path}.value`,'exige número finito');} else {
            try{pathKeys(definition[prop]);}catch(error){issue(`${path}.${prop}`,error.message);}
            try {if(prop==='system' && getByPath(system,definition.system)===undefined) issue(`${path}.system`,'valor inexistente no sistema');} catch { /* caminho já diagnosticado */ }
          }
        }
      }
      if (!source.collection && source.valueField !== undefined) issue(`${at}.valueField`, 'exige collection');
      if (typeof source.label !== 'string' || !source.label.trim()) issue(`${at}.label`, 'exige rótulo');
      if (['field', 'collection', 'formula'].filter(key => source[key] !== undefined).length !== 1) issue(at, 'use field, collection ou formula, exclusivamente');
      if (source.formula && !Object.hasOwn(system.formulas || {}, source.formula)) issue(`${at}.formula`, 'fórmula inexistente');
      for (const prop of source.collection ? ['collection', 'valueField'] : source.formula ? ['formula'] : ['field']) {
        try { pathKeys(source[prop]); } catch (error) { issue(`${at}.${prop}`, error.message); }
      }
    });
  }
}

// Campos ausentes seguem opcionais; tipos errados são recusados antes de salvar.
export function validateCheckData(character, checks, issues, root = 'character') {
  const issue = (path, message) => issues.push({path, message, code:'invalid'});
  const checkValue = (value, text, path) => {
    if (value == null) return;
    if (text ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) issue(path, text ? 'deve ser expressão textual' : 'deve ser número finito');
  };
  for (const config of Object.values(checks || {})) {
    if (!config || !Array.isArray(config.sources)) continue;
    if (config.momentumField) { try { checkValue(getByPath(character, config.momentumField),false,`${root}.${config.momentumField}`); } catch {} }
    for (const source of config.sources) {
      if (!source || typeof source !== 'object') continue;
      try {
        const expression = config.algorithm === 'explodingDamage';
        if (source.field) checkValue(getByPath(character,source.field),expression,`${root}.${source.field}`);
        if (source.collection) {
          const entries = getByPath(character,source.collection);
          if (entries == null) continue;
          if (!Array.isArray(entries)) { issue(`${root}.${source.collection}`,'deve ser lista'); continue; }
          const ids = new Set();
          entries.forEach((entry,index) => {
            const at = `${root}.${source.collection}[${index}]`;
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { issue(at,'deve ser objeto'); return; }
            if (entry.id != null) { if (typeof entry.id !== 'string' || ids.has(entry.id)) issue(`${at}.id`,'exige ID textual único'); ids.add(entry.id); }
            checkValue(getByPath(entry,source.valueField),expression,`${at}.${source.valueField}`);
          });
        }
      } catch { /* Caminhos são diagnosticados por validateChecks. */ }
    }
  }
}
