import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capabilityCatalog} from '../js/editor/capability-catalog.js';
import {structuralNodes} from '../js/editor/form-structure.js';
import {COMPONENT_CONTRACTS} from '../js/validation/contracts.js';
const root=fileURLToPath(new URL('../',import.meta.url)),load=async file=>JSON.parse(await readFile(resolve(root,file),'utf8')),manifest=await load('data/systems/index.json'),properties=capabilityCatalog(),occurrences=[];
for(const entry of manifest.systems){const system=await load('data/systems/'+entry.system.replace(/^\.\//,'')),layouts=await Promise.all(entry.layouts.map(l=>load('data/systems/'+l.file.replace(/^\.\//,''))));for(const node of structuralNodes({system,layouts}))if(node.kind==='component')for(const property of Object.keys(node.value||{})){const desc=COMPONENT_CONTRACTS[node.value.type]?.properties[property];occurrences.push({system:entry.id,layout:layouts[node.path[1]].id,pointer:node.pointer,type:node.value.type,property,contract:!!desc,inert:desc?.inert===true,control:desc?properties.find(r=>r.context==='component:'+node.value.type&&r.property===property)?.control||'valor tipado':'extra tipado; semântica não inferida'});}}
const result={scope:'Autoria das capacidades atuais; extensões de engine e compreensão humana não são comprovadas por este inventário.',generation:'Projeção de contracts.js e form-metadata.js, com ocorrências dos assets públicos. Não é um schema ou formato de pacote.',systems:manifest.systems.length,layouts:manifest.systems.reduce((n,s)=>n+s.layouts.length,0),properties,occurrences},text=JSON.stringify(result,null,2)+'\n',target=resolve(root,'data/examples/editor-capabilities.json');
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==text)throw Error('Inventário público desatualizado; execute node scripts/build-editor-capabilities.mjs.');}else await writeFile(target,text);
console.log(`${properties.length} propriedades/contextos; ${occurrences.length} ocorrências em ${result.systems} sistemas/${result.layouts} layouts.`);
