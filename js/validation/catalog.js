export function validCatalogIds(ids) {
  return Array.isArray(ids) && ids.every(id => typeof id === 'string' && id.trim() !== '') && new Set(ids).size === ids.length;
}
