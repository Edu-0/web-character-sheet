import { assertValid, validateManifest, validateSystemPackage } from '../validation/schemas.js';

const MANIFEST_URL = './data/systems/index.json';
const IMPORTED_SYSTEMS_KEY = 'ficha-rpg:v2:systems';

let manifestSystems = [];
let importedSystems = [];

function clone(value) {
  return value == null ? value : structuredClone(value);
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Não foi possível carregar ${label}: HTTP ${response.status}`);
  return response.json();
}

function loadImportedSystems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(IMPORTED_SYSTEMS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistImportedSystems() {
  localStorage.setItem(IMPORTED_SYSTEMS_KEY, JSON.stringify(importedSystems));
}

export async function initSystemRepository() {
  const manifest = await fetchJson(MANIFEST_URL, 'o manifesto de sistemas');
  assertValid(manifest, validateManifest, 'manifest');
  manifestSystems = manifest.systems.map((entry) => ({ ...entry, source: 'builtin' }));
  importedSystems = loadImportedSystems().filter((pkg) => validateSystemPackage(pkg).length === 0);
  persistImportedSystems();
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
  return [...builtins, ...imported];
}

export function hasSystem(id) {
  return listSystems().some((system) => system.id === id);
}

export async function getSystemPackage(id) {
  const imported = importedSystems.find((pkg) => pkg.system.id === id);
  if (imported) return clone(imported);

  const entry = manifestSystems.find((system) => system.id === id);
  if (!entry) throw new Error(`Sistema "${id}" não está disponível.`);
  const system = await fetchJson(new URL(entry.system, new URL(MANIFEST_URL, location.href)), `o sistema ${entry.name}`);
  const layouts = await Promise.all((entry.layouts || []).map(async (layoutRef) => ({
    ...await fetchJson(new URL(layoutRef.file, new URL(MANIFEST_URL, location.href)), `o layout ${layoutRef.name}`),
    manifest: { id: layoutRef.id, name: layoutRef.name },
  })));
  return assertValid(
    { schemaVersion: 1, kind: 'rpg-system-package', system, layouts },
    validateSystemPackage,
    `sistema ${id}`,
  );
}

export async function importSystemPackage(file) {
  let pkg;
  try {
    pkg = JSON.parse(await file.text());
  } catch {
    throw new Error('O arquivo do sistema não contém JSON válido.');
  }
  assertValid(pkg, validateSystemPackage, 'pacote de sistema');
  if (manifestSystems.some((entry) => entry.id === pkg.system.id)) {
    throw new Error(`O ID "${pkg.system.id}" pertence a um sistema embutido.`);
  }
  importedSystems = importedSystems.filter((item) => item.system.id !== pkg.system.id);
  importedSystems.push(clone(pkg));
  persistImportedSystems();
  return clone(pkg);
}

export async function exportSystemPackage(id) {
  return getSystemPackage(id);
}
