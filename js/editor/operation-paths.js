export { RESERVED_KEYS } from '../engine/paths.js';
import { RESERVED_KEYS } from '../engine/paths.js';
export function inspectPlaceholder(path) {
  if (!Array.isArray(path) || path.length>32 || path.some(key=>typeof key!=='string' && !Number.isInteger(key) || RESERVED_KEYS.has(String(key)) || String(key)==='' || typeof key==='number' && key<0)) throw new Error('Caminho de operação inválido.');
}
