import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {COMPONENT_CONTRACTS,COMMON_COMPONENT_PROPERTIES,ITEM_FIELD_CONTRACTS,CHECK_CONTRACT,CHECK_ALGORITHMS,CHECK_UNITS,EFFECT_EVENTS,EFFECT_LIMITS,RUNTIME_DEFAULTS,ENTRY_ROLL_CONTRACT,RECOVERY_CONTRACT} from '../js/validation/contracts.js';
import {SUPPORTED_VERSIONS} from '../js/validation/versions.js';
import {validateSystemPackage,validateCharacterForPackage} from '../js/validation/schemas.js';
const root=new URL('../',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
const read=path=>readFile(new URL(path,root),'utf8');
const json=async path=>JSON.parse(await read(path));

export async function verifyReferenceExamples() {
  const paths=(await readdir(new URL('data/examples/',root))).filter(name=>name.endsWith('.package.json')).sort();
  for(const name of paths) {
    const pkg=await json(`data/examples/${name}`);
    const character={...structuredClone(pkg.system.characterTemplate),meta:{...pkg.system.characterTemplate.meta,id:'reference-check'}};
    const errors=[...validateSystemPackage(pkg),...validateCharacterForPackage(character,pkg)].filter(issue=>issue.severity!=='warning');
    if(errors.length) throw new Error(`${name}: ${errors[0].path}: ${errors[0].message}`);
  }
  return paths;
}
function parameterTable(properties) {
  const rows=['| Parâmetro | Tipo | Obrigatório | Default/enum/condição |','| --- | --- | --- | --- |'];
  for(const [key,p] of Object.entries(properties).sort(([a],[b])=>a.localeCompare(b,'en'))) {
    const details=[p.default!==undefined?`default: ${JSON.stringify(p.default)}`:'',p.enum?`enum: ${p.enum.join(', ')}`:'',p.alias?`alias legado de ${p.alias}`:'',p.inert?'inert nesta posição':'',p.semantic || ''].filter(Boolean).join('; ');
    rows.push(`| \`${key}\` | ${p.type} | ${p.required?'sim':'não'} | ${details.replaceAll('|',' / ')} |`);
  }
  return rows.join('\n');
}

export async function referenceOutputs({components=COMPONENT_CONTRACTS}={}) {
  const examples=await verifyReferenceExamples();
  const validators=(await readdir(new URL('js/validation/',root))).filter(name=>name.endsWith('.js')).map(name=>`js/validation/${name}`);
  const sources=[...new Set([...validators,...Object.values(components).map(c=>c.source),'js/engine/computed-values.js','js/engine/checks.js','js/engine/dice-resolver.js','js/engine/effects.js','js/engine/entry-rolls.js','js/engine/recovery.js','js/dice.js'])].sort();
  if(sources.some(source=>!source.startsWith('js/')||source.includes('..'))) throw new Error('Fonte fora do código público.');
  const fingerprints=Object.fromEntries(await Promise.all(sources.map(async source=>[source,hash(await read(source))])));
  const data=sorted({schemaVersion:1,components,itemFields:ITEM_FIELD_CONTRACTS,checks:CHECK_CONTRACT,algorithms:CHECK_ALGORITHMS,checkUnits:CHECK_UNITS,effectEvents:EFFECT_EVENTS,effectLimits:EFFECT_LIMITS,defaults:RUNTIME_DEFAULTS,entryRolls:ENTRY_ROLL_CONTRACT,recovery:RECOVERY_CONTRACT,supportedVersions:SUPPORTED_VERSIONS,examples,sources:fingerprints});
  const lines=['# Referência gerada de componentes e parâmetros','','Gerada por `npm run build:reference`; confira com `npm run check:reference`. Não edite este arquivo à mão. Descritores são consumidos pela validação de formas/chaves; regras semânticas permanecem nos validadores indicados. Extras seguros são preservados como metadados inertes, sem ampliar operações permitidas.','',
    `São ${Object.keys(components).length} componentes e ${Object.keys(ITEM_FIELD_CONTRACTS).length} tipos internos. As condições dependentes de sistema/layout/personagem são verificadas por [schemas](../../js/validation/schemas.js), [referências](../../js/validation/references.js) e [referências de rolagem](../../js/validation/roll-references.js). Valores default listados abaixo vêm de constantes consumidas pelo runtime; ausência de default significa que ele não foi extraído para este contrato, não uma promessa de valor vazio.`,
    '',`Fingerprint do código público consultado: \`${hash(JSON.stringify(fingerprints))}\`. [Artefato de contrato e hashes](components-reference.json). O check recusa referência desatualizada após mudanças nestas fontes. Não é um JSON Schema completo.`,
    '','## Propriedades comuns','',parameterTable(COMMON_COMPONENT_PROPERTIES),''];
  for(const [type,contract] of Object.entries(components).sort(([a],[b])=>a.localeCompare(b,'en'))) {
    lines.push(`## ${type}`,'',contract.summary,'',`Implementação: [${contract.source}](${`../../${contract.source}`}). Validação semântica: ${contract.semantic}.`,
      '',parameterTable(Object.fromEntries(Object.entries(contract.properties).filter(([key,p])=>JSON.stringify(p)!==JSON.stringify(COMMON_COMPONENT_PROPERTIES[key])))),'');
  }
  lines.push('## Campos internos de itemSchema','','Tipos aceitos como string curta ou `{type, …}`. Não herdam os defaults/controles dos campos de nível superior. Referências de coleção e checkboxes têm condições adicionais em schemas/references; nenhuma chave nova executa código.','');
  for(const [type,properties] of Object.entries(ITEM_FIELD_CONTRACTS)) lines.push(`### ${type}`,'',parameterTable(properties),'');
  lines.push('## Contratos transversais','',`Versões suportadas: ${Object.entries(SUPPORTED_VERSIONS).map(([kind,v])=>`${kind}: ${v.join('/')}`).join('; ')}. Envelope v2 quando o conteúdo exige v2. A migração precisa de revisão/cópia do original; não há downgrade automático.`,
    '',`Algoritmos: ${CHECK_ALGORITHMS.join(', ')}. progress não recebe efeitos de teste. Unidade por algoritmo: ${Object.entries(CHECK_UNITS).map(([key,v])=>`${key}=${v}`).join('; ')}.`,
    '',`Efeitos: eventos ${EFFECT_EVENTS.join(', ')}; limites ${JSON.stringify(EFFECT_LIMITS)}; definição/revisão no sistema, instância no personagem. [Contrato e limites](effects.md).`,
    '',`Defaults compartilhados: ${JSON.stringify(RUNTIME_DEFAULTS)}.`,
    '','| Contrato | Chaves/enum aceitos |','| --- | --- |');
  for(const [name,contract] of Object.entries({checks:CHECK_CONTRACT,entryRolls:ENTRY_ROLL_CONTRACT,recovery:RECOVERY_CONTRACT})) for(const [key,value] of Object.entries(contract)) lines.push(`| ${name}.${key} | ${Array.isArray(value)?value.map(v=>`\`${v}\``).join(', '):JSON.stringify(value)} |`);
  lines.push('','[Rolagens de entradas e suas condições](README.md), [testes/botões](testing.md), [recuperação](recovery.md) e [validação documental](validation.md) explicam o uso. As listas acima são as mesmas importadas pelos validadores; extensions é permitido como metadado inerte nos contratos estritos. Não traduzir uma regra narrativa para automação sem definição verificada.','',
    '## Exemplos verificados','',...examples.map(name=>`- [${name}](${name})`),'','O gerador valida cada pacote e personagem-template pelo código real. Testes negativos/de preservação e comparação do registro de renderizadores ficam nas suítes Node/Playwright. Estes exemplos são fictícios; a referência não copia conteúdo de livros.','');
  return {markdown:lines.join('\n'),json:JSON.stringify(data,null,2)+'\n',examples};
}
export async function buildReference({check=false}={}) {
  const result=await referenceOutputs();
  for(const [name,content] of [['components-reference.md',result.markdown],['components-reference.json',result.json]]) {
    const url=new URL(`data/examples/${name}`,root);
    if(check) {if(await readFile(url,'utf8').catch(()=>null)!==content) throw new Error(`Referência desatualizada: ${name}; execute npm run build:reference.`);}
    else await writeFile(url,content);
  }
  return result;
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) {
  try {const result=await buildReference({check:process.argv.includes('--check')});console.log(`${Object.keys(COMPONENT_CONTRACTS).length} componentes; ${result.examples.length} exemplos verificados; referência ${process.argv.includes('--check')?'conferida':'gerada'}.`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
