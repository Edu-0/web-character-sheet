import {readJson, readRaw, transactWithinWrite} from '../persistence.js';
import {withLibraryWrite} from '../write-coordinator.js';
import {validCatalogIds} from '../validation/catalog.js';

export const CATALOG_KEY = 'ficha-rpg:v2:catalog-installations';
export function catalogInstallationIds() {
  const ids = readJson(CATALOG_KEY, null, validCatalogIds);
  if (ids === null && readRaw(CATALOG_KEY) !== null) throw new Error('A seleção do catálogo está inválida. Exporte a recuperação antes de alterá-la.');
  return ids ?? [];
}
export function catalogInstallationsChange(ids) {
  if (!validCatalogIds(ids)) throw new Error('Seleção do catálogo inválida.');
  return [CATALOG_KEY, JSON.stringify(ids)];
}
export async function initializeCatalogInstallations(ids) {
  // Migração única: manter os sistemas que já apareciam na biblioteca. Novos
  // itens do manifesto não são instalados automaticamente nas próximas versões.
  await withLibraryWrite(() => {
    if (readRaw(CATALOG_KEY) === null) transactWithinWrite([catalogInstallationsChange(ids)]);
  });
}
