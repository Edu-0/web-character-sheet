import { readJson, readRaw, preserveRaw, transact, migrationCopyChange } from '../persistence.js';
import { LIMITS, readJsonFile } from '../validation/limits.js';
import { assertValid, validateManifest, validateSystemPackage, validateCharacterForPackage } from '../validation/schemas.js';
import { prepareDocument } from '../validation/documents.js';
import { validateEffectRevisionChange } from '../validation/effects.js';

const MANIFEST_URL = './data/systems/index.json';
const IMPORTED_SYSTEMS_KEY = 'ficha-rpg:v2:systems';

let manifestSystems = [];
let importedSystems = [];
let unavailableSystems = [];

function clone(value) {
  return value == null ? value : structuredClone(value);
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não foi possível carregar ${label}: HTTP ${response.status}`);
  return response.json();
}

function loadImportedSystems() {
  const all = readJson(IMPORTED_SYSTEMS_KEY, [], Array.isArray);
  const valid = []; unavailableSystems = [];
  for (const pkg of all) {
    const result = prepareDocument(pkg,{kind:'package'});
    if (result.status==='ready') valid.push(pkg);
    else unavailableSystems.push(pkg);
  }
  if (unavailableSystems.length) preserveRaw(IMPORTED_SYSTEMS_KEY,readRaw(IMPORTED_SYSTEMS_KEY),'Pacotes indisponíveis preservados; os demais continuam acessíveis.');
  return valid;
}

export function importedPackages() { return clone(importedSystems); }
export function importedSystemsChange(packages, {replace = false} = {}) { return [IMPORTED_SYSTEMS_KEY, JSON.stringify([...packages,...(replace?[]:unavailableSystems)])]; }
export function reloadImportedSystems() { importedSystems = loadImportedSystems(); }

export async function initSystemRepository() {
  const manifest = await fetchJson(MANIFEST_URL, 'o manifesto de sistemas');
  assertValid(manifest, validateManifest, 'manifest');
  manifestSystems = manifest.systems.map((entry) => ({ ...entry, source: 'builtin' }));
  importedSystems = loadImportedSystems();
  return listSystems();
}

export function listSystems() {
  const builtins = manifestSystems.map((entry) => ({
    id: entry.id,
    name: entry.name,
    source: 'builtin',
    layoutCount: entry.layouts?.length ?? 0,
  }));
  const imported = importedSystems.map((pkg) => ({
    id: pkg.system.id,
    name: pkg.system.name,
    source: 'imported',
    layoutCount: pkg.layouts.length,
  }));
  return [...builtins, ...imported, ...unavailableSystems.map((pkg,index)=>({id:pkg?.system?.id || `unavailable-${index}`,name:pkg?.system?.name || 'Pacote indisponível',source:'unavailable',layoutCount:0,unavailable:true}))];
}

export function hasSystem(id) {
  return listSystems().some((system) => system.id === id && !system.unavailable);
}

export async function getSystemPackage(id) {
  const imported = importedSystems.find((pkg) => pkg.system.id === id);
  if (imported) return clone(imported);

  const entry = manifestSystems.find((system) => system.id === id);
  if (!entry) throw new Error(`Sistema "${id}" não está disponível.`);
  const system = await fetchJson(new URL(entry.system, new URL(MANIFEST_URL, location.href)), `o sistema ${entry.name}`);
  if (system.id!==entry.id) throw new Error('manifest.system.id: ID do sistema carregado diverge do manifesto.');
  const layouts = await Promise.all((entry.layouts || []).map(async (layoutRef) => ({
    ...await fetchJson(new URL(layoutRef.file, new URL(MANIFEST_URL, location.href)), `o layout ${layoutRef.name}`),
    manifest: { id: layoutRef.id, name: layoutRef.name },
  })));
  for (const layout of layouts) if (layout.id!==layout.manifest.id) throw new Error('manifest.layout.id: ID do layout carregado diverge do manifesto.');
  return assertValid(
    { schemaVersion: Math.max(system.schemaVersion, ...layouts.map(layout => layout.schemaVersion)), kind: 'rpg-system-package', system, layouts },
    validateSystemPackage,
    `sistema ${id}`,
  );
}

export async function importSystemPackage(file, { replace = false, currentCharacter, confirmMigration } = {}) {
  let pkg = await readJsonFile(file, LIMITS.systemBytes, 'package');
  let migrationPlan;
  const prepared=prepareDocument(pkg,{kind:'package',normalize:Boolean(confirmMigration)});
  assertValid(pkg,()=>prepared.diagnostics,'pacote de sistema');
  const previous = importedSystems.find(item=>item.system.id===pkg.system.id);
  if (previous) assertValid(pkg.system, next=>validateEffectRevisionChange(previous.system,next),'revisão de efeitos');
  if (manifestSystems.some((entry) => entry.id === pkg.system.id)) {
    throw new Error(`O ID "${pkg.system.id}" pertence a um sistema embutido.`);
  }
  if (!replace && [...importedSystems,...unavailableSystems].some(item => item?.system?.id === pkg.system.id)) { const error = new Error('Já existe um sistema com este ID. Confirme a substituição.'); error.code = 'system-conflict'; throw error; }
  if (confirmMigration) {
    if (prepared.status==='needsMigration') {
      if (!await confirmMigration(prepared.migrationPlan)) throw new Error('Importação cancelada; o original foi preservado.');
      migrationPlan=prepared.migrationPlan; pkg=prepared.document;
    }
  }
  pkg=prepared.document;
  assertValid(pkg, validateSystemPackage, 'pacote de sistema');
  const baseline=readRaw(IMPORTED_SYSTEMS_KEY);
  const characters=await import('./character-repository.js');
  if(characters.listCharacters().some(character=>character.system===pkg.system.id && character.unavailable)) throw new Error('Há personagem indisponível vinculado ao sistema. Exporte/corrija o original antes de substituir o pacote.');
  const linked=characters.allCharacters().filter(character=>character.meta.system===pkg.system.id);
  if(currentCharacter?.meta?.system===pkg.system.id) {
    const index=linked.findIndex(character=>character.meta.id===currentCharacter.meta.id);
    if(index<0) linked.push(currentCharacter); else linked[index]=currentCharacter;
  }
  for(const character of linked) assertValid(character,value=>validateCharacterForPackage(value,pkg),`personagem ${character.meta.id}`);
  if (readRaw(IMPORTED_SYSTEMS_KEY)!==baseline) throw new Error('A biblioteca mudou durante a revisão. Tente importar novamente.');
  const next = [...importedSystems.filter(item => item.system.id !== pkg.system.id), clone(pkg)];
  const changes=[[IMPORTED_SYSTEMS_KEY,JSON.stringify([...next,...unavailableSystems.filter(item=>item?.system?.id!==pkg.system.id)])]];
  if(replace && baseline) changes.push(migrationCopyChange(IMPORTED_SYSTEMS_KEY,JSON.parse(baseline)));
  if(migrationPlan) changes.push(migrationCopyChange(`import:${file.name}`,migrationPlan.original));
  transact(changes);
  importedSystems = next;
  unavailableSystems=unavailableSystems.filter(item=>item?.system?.id!==pkg.system.id);
  return clone(pkg);
}

export async function exportSystemPackage(id) {
  const unavailable=unavailableSystems.find(pkg=>pkg?.system?.id===id);
  if(unavailable) return clone(unavailable);
  return getSystemPackage(id);
}
