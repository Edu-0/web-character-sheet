import { readJson, readRaw, preserveRaw, transactWithinWrite, migrationCopyChange,storageKeys } from '../persistence.js';
import {withLibraryWrite,verifyWriterClients,coordinatedWritesAvailable} from '../write-coordinator.js';
import {installationPlan} from './package-installation.js';
import * as characters from './character-repository.js';
import {resetSettingsCache} from '../storage.js';
import { LIMITS, readJsonFile } from '../validation/limits.js';
import { assertValid, validateManifest, validateSystemPackage, validateCharacterForPackage } from '../validation/schemas.js';
import { prepareDocument } from '../validation/documents.js';
import { validateEffectRevisionChange } from '../validation/effects.js';
import {CATALOG_KEY, catalogInstallationIds, catalogInstallationsChange, initializeCatalogInstallations} from './catalog-installations.js';

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

export function importedPackages() { reloadImportedSystems();return clone(importedSystems); }
export function importedSystemsChange(packages, {replace = false} = {}) { return [IMPORTED_SYSTEMS_KEY, JSON.stringify([...packages,...(replace?[]:unavailableSystems)])]; }
export function reloadImportedSystems() { importedSystems = loadImportedSystems(); }

function currentImported(id) {
  const all=readJson(IMPORTED_SYSTEMS_KEY,[],Array.isArray);return all.find(pkg=>pkg?.system?.id===id) || null;
}
function writableImportedCollection() {
  const all=readJson(IMPORTED_SYSTEMS_KEY,null,Array.isArray);
  if(all===null && readRaw(IMPORTED_SYSTEMS_KEY)!==null)throw new Error('A coleção de sistemas está inválida. Exporte a recuperação antes de instalar ou editar pacotes.');
  return all ?? [];
}
export function installedPackageBase(id){return clone(currentImported(id));}
function librarySnapshot() {
  return JSON.stringify(storageKeys().filter(key=>key===IMPORTED_SYSTEMS_KEY || key===CATALOG_KEY || key==='ficha-rpg:settings' || key.startsWith('ficha-rpg:v2:characters:')).sort().map(key=>[key,readRaw(key)]));
}
export function prepareSystemInstallation(candidate,{expectedBase,currentCharacter}={}) {
  const current=currentImported(candidate.system?.id), base=expectedBase===undefined?current:expectedBase;
  const summaries=characters.listCharacters(),linked=characters.allCharacters().filter(character=>character.meta.system===candidate.system.id);
  if(currentCharacter?.meta?.system===candidate.system.id){const index=linked.findIndex(character=>character.meta.id===currentCharacter.meta.id);if(index<0)linked.push(clone(currentCharacter));else linked[index]=clone(currentCharacter);}
  const reserved=manifestSystems.filter(entry=>!(entry.id===current?.system?.id && catalogInstallationIds().includes(entry.id))).map(entry=>entry.id);
  const plan=installationPlan({candidate,base,currentPackage:current,builtinIds:reserved,characters:linked,unavailableLinked:summaries.some(character=>character.system===candidate.system.id && character.unavailable),unavailableUnidentified:summaries.some(character=>character.system==='indisponível' && character.unavailable)});
  return {...plan,librarySnapshot:librarySnapshot(),activeSnapshot:JSON.stringify(currentCharacter ?? null)};
}
export async function installSystemPackage(plan,{currentCharacter,copies=[],assertCurrent=()=>{}}={}) {
  if(plan.replace)await verifyWriterClients();
  return withLibraryWrite(()=>{
    assertCurrent();
    if(librarySnapshot()!==plan.librarySnapshot || JSON.stringify(currentCharacter ?? null)!==plan.activeSnapshot)throw new Error('A biblioteca ou o personagem ativo mudou durante a confirmação. Revise e tente novamente.');
    const fresh=prepareSystemInstallation(plan.package,{expectedBase:plan.base,currentCharacter});
    const all=writableImportedCollection(),baseline=readRaw(IMPORTED_SYSTEMS_KEY);
    const next=[...all.filter(pkg=>pkg?.system?.id!==fresh.package.system.id),clone(fresh.package)];
    const changes=[[IMPORTED_SYSTEMS_KEY,JSON.stringify(next)],...copies];
    const preferences=readJson('ficha-rpg:settings',{},value=>value && typeof value==='object' && !Array.isArray(value));
    const selection=preferences.layoutSelections?.find(entry=>entry.systemId===fresh.package.system.id);
    if(selection && !fresh.package.layouts.some(layout=>layout.id===selection.layoutId)){
      selection.layoutId=fresh.package.layouts[0].id;changes.push(['ficha-rpg:settings',JSON.stringify(preferences)]);
    }
    if(fresh.replace && baseline)changes.push(migrationCopyChange(IMPORTED_SYSTEMS_KEY,JSON.parse(baseline)));
    transactWithinWrite(changes);reloadImportedSystems();resetSettingsCache();return clone(fresh.package);
  });
}

export async function initSystemRepository() {
  const manifest = await fetchJson(MANIFEST_URL, 'o manifesto de sistemas');
  assertValid(manifest, validateManifest, 'manifest');
  manifestSystems = manifest.systems.map((entry) => ({ ...entry, source: 'builtin' }));
  await initializeCatalogInstallations(manifestSystems.map(entry=>entry.id));
  importedSystems = loadImportedSystems();
  return listSystems();
}

export function listSystems() {
  const installed = catalogInstallationIds();
  const builtins = manifestSystems.filter(entry=>installed.includes(entry.id)).map((entry) => ({
    id: entry.id,
    name: importedSystems.find(pkg=>pkg.system.id===entry.id)?.system.name ?? entry.name,
    source: 'builtin',
    layoutCount: importedSystems.find(pkg=>pkg.system.id===entry.id)?.layouts.length ?? entry.layouts?.length ?? 0,
    ...(unavailableSystems.some(pkg=>pkg?.system?.id===entry.id)?{unavailable:true}:{}),
  }));
  const imported = importedSystems.filter(pkg=>!manifestSystems.some(entry=>entry.id===pkg.system.id) || !installed.includes(pkg.system.id)).map((pkg) => ({
    id: pkg.system.id,
    name: pkg.system.name,
    source: 'imported',
    layoutCount: pkg.layouts.length,
    ...(manifestSystems.some(entry=>entry.id===pkg.system.id)?{unavailable:true}:{}),
  }));
  return [...builtins, ...imported, ...installed.filter(id=>!manifestSystems.some(entry=>entry.id===id)).map(id=>({id,name:id,source:'builtin',layoutCount:0,unavailable:true})), ...unavailableSystems.filter(pkg=>!builtins.some(entry=>entry.id===pkg?.system?.id)).map((pkg,index)=>({id:pkg?.system?.id || `unavailable-${index}`,name:pkg?.system?.name || 'Pacote indisponível',source:'unavailable',layoutCount:0,unavailable:true}))];
}

export function listCatalogSystems() {
  const installed=catalogInstallationIds();
  return manifestSystems.map(entry=>({id:entry.id,name:entry.name,layoutCount:entry.layouts?.length ?? 0,installed:installed.includes(entry.id)}));
}

export async function installCatalogSystem(id) {
  const pkg=await getCatalogPackage(id);
  return withLibraryWrite(()=>{
    const ids=catalogInstallationIds();
    if(ids.includes(id))return clone(pkg);
    const summaries=characters.listCharacters();
    // Reutiliza o preflight de instalação; IDs reservados só entram por este
    // caminho, com pacote validado carregado do manifesto do aplicativo.
    installationPlan({candidate:pkg,base:null,currentPackage:null,
      characters:characters.allCharacters().filter(character=>character.meta.system===id),
      unavailableLinked:summaries.some(character=>character.system===id && character.unavailable)});
    if(currentImported(id))throw new Error('Há um pacote local com o ID reservado deste catálogo. Preserve o original antes de instalar.');
    const all=writableImportedCollection();
    transactWithinWrite([[IMPORTED_SYSTEMS_KEY,JSON.stringify([...all,clone(pkg)])],catalogInstallationsChange([...ids,id])]);
    reloadImportedSystems();
    return clone(pkg);
  });
}

export async function editableCatalogPackage(id) {
  if(!manifestSystems.some(entry=>entry.id===id))throw new Error('Sistema ausente do catálogo.');
  const original=await getCatalogPackage(id);
  return withLibraryWrite(()=>{
    if(!catalogInstallationIds().includes(id))throw new Error('Sistema removido durante a abertura do editor. Instale pelo Catálogo.');
    const existing=currentImported(id);
    if(existing)return clone(existing);
    const all=writableImportedCollection();
    transactWithinWrite([[IMPORTED_SYSTEMS_KEY,JSON.stringify([...all,clone(original)])]]);
    reloadImportedSystems();return clone(original);
  });
}

export function hasSystem(id) {
  return listSystems().some((system) => system.id === id && !system.unavailable);
}

export async function getSystemPackage(id) {
  reloadImportedSystems();
  if(unavailableSystems.some(pkg=>pkg?.system?.id===id))throw new Error('O pacote local está indisponível. Exporte o original para corrigir; o catálogo não o substituirá automaticamente.');
  if(manifestSystems.some(entry=>entry.id===id) && !catalogInstallationIds().includes(id))throw new Error(`Sistema "${id}" não está instalado. Instale pelo Catálogo.`);
  const imported = importedSystems.find((pkg) => pkg.system.id === id);
  if (imported) return clone(imported);

  if(!catalogInstallationIds().includes(id))throw new Error(`Sistema "${id}" não está instalado. Instale pelo Catálogo.`);
  return getCatalogPackage(id);
}

export async function getCatalogPackage(id) {

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

export async function importSystemPackage(file, { replace = false, currentCharacter, confirmMigration,expectedBase } = {}) {
  let pkg = await readJsonFile(file, LIMITS.systemBytes, 'package');
  let migrationPlan;
  const prepared=prepareDocument(pkg,{kind:'package',normalize:Boolean(confirmMigration)});
  assertValid(pkg,()=>prepared.diagnostics,'pacote de sistema');
  const previous = currentImported(pkg.system.id);
  if (previous) assertValid(pkg.system, next=>validateEffectRevisionChange(previous.system,next),'revisão de efeitos');
  if (manifestSystems.some((entry) => entry.id === pkg.system.id) && !(previous && catalogInstallationIds().includes(pkg.system.id))) {
    throw new Error(`O ID "${pkg.system.id}" pertence a um sistema embutido.`);
  }
  if (!replace && previous) { const error = new Error('Já existe um sistema com este ID. Confirme a substituição.'); error.code = 'system-conflict'; error.base=clone(previous); throw error; }
  const initialBase=expectedBase===undefined?previous:expectedBase,initialSnapshot=librarySnapshot(),initialActive=JSON.stringify(currentCharacter ?? null);
  if (confirmMigration) {
    if (prepared.status==='needsMigration') {
      if (!await confirmMigration(prepared.migrationPlan)) throw new Error('Importação cancelada; o original foi preservado.');
      migrationPlan=prepared.migrationPlan; pkg=prepared.document;
    }
  }
  pkg=prepared.document;
  assertValid(pkg, validateSystemPackage, 'pacote de sistema');
  if(librarySnapshot()!==initialSnapshot || JSON.stringify(currentCharacter ?? null)!==initialActive)throw new Error('A biblioteca ou o personagem ativo mudou durante a revisão. Tente importar novamente.');
  const plan=prepareSystemInstallation(pkg,{expectedBase:initialBase,currentCharacter});
  return installSystemPackage(plan,{currentCharacter,copies:migrationPlan?[migrationCopyChange(`import:${file.name}`,migrationPlan.original)]:[]});
}

export async function exportSystemPackage(id) {
  const unavailable=unavailableSystems.find(pkg=>pkg?.system?.id===id);
  if(unavailable) return clone(unavailable);
  return getSystemPackage(id);
}
