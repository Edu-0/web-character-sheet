import {expandComponents} from '../engine/layout-components.js';
import {getByPath} from '../engine/paths.js';
import {ROLL_OPTION_ALIASES} from '../validation/contracts.js';

// Somente locais consumidos pelo contrato; extras/metadata nunca são percorridos.
export function planNormalization(document, kind, {pkg} = {}) {
  const draft = structuredClone(document), changes = [];
  const alias = (object, oldKey, key, path) => {
    if (!object || !Object.hasOwn(object, oldKey)) return;
    if (Object.hasOwn(object,key) && JSON.stringify(object[key]) !== JSON.stringify(object[oldKey])) throw new Error(`${path}.${key}: aliases conflitantes; escolha o valor antes de importar.`);
    object[key] = object[oldKey]; delete object[oldKey]; changes.push(`${path}.${oldKey} → ${key}`);
  };
  const containers = layout => (layout.tabs || []).flatMap(tab => (tab.sections || []).flatMap(section => section.containers || []));
  const character = (value, context, path) => {
    if (!context) return; // Sem pacote disponível, não deduzir coleções pelo nome.
    const fields = new Set(context.layouts.flatMap(layout => containers(layout).flatMap(container => expandComponents(container,context.system)))
      .filter(component => component.type === 'list' && ['roll','dndSpell','dndAttack'].includes(component.entryAction)).map(component => component.field));
    for (const field of fields) {
      const entries = getByPath(value,field);
      if (!Array.isArray(entries)) continue;
      entries.forEach((entry,index) => {
        for (const [oldKey,key] of ROLL_OPTION_ALIASES) alias(entry?.rollOptions,oldKey,key,`${path}.${field}[${index}].rollOptions`);
      });
    }
  };
  const layout = (value,path) => (value.tabs || []).forEach((tab,ti) => (tab.sections || []).forEach((section,si) => (section.containers || []).forEach((container,ci) => (container.components || []).forEach((component,i) => {
    if (component.type === 'list' && component.entryAction === 'roll') alias(component,'rollConfigFrom','rollPreset',`${path}.tabs[${ti}].sections[${si}].containers[${ci}].components[${i}]`);
  }))));
  const system = (value,path) => {
    for (const [id,config] of Object.entries(value.entryRolls || {})) alias(config,'test','check',`${path}.entryRolls.${id}`);
  };
  const packageDocument = (value,path) => {
    system(value.system,`${path}.system`);
    value.layouts.forEach((entry,index) => layout(entry,`${path}.layouts[${index}]`));
    character(value.system.characterTemplate,value,`${path}.system.characterTemplate`);
  };
  if (kind === 'package') packageDocument(draft,kind);
  else if (kind === 'system') { system(draft,kind); character(draft.characterTemplate,pkg && {...pkg,system:draft},`${kind}.characterTemplate`); }
  else if (kind === 'layout') layout(draft,kind);
  else if (kind === 'character') character(draft,pkg,kind);
  else if (kind === 'backup') {
    draft.systems.forEach((entry,index) => packageDocument(entry,`${kind}.systems[${index}]`));
    for (const [index,entry] of draft.characters.entries()) character(entry,draft.systems.find(candidate => candidate.system.id === entry.meta?.system),`${kind}.characters[${index}]`);
  }
  return { kind, original: structuredClone(document), document: draft, changes };
}
