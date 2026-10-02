// engine/paths.js
// Utilitário genérico de leitura/escrita por caminho pontilhado (ex: "abilities.str.score").
// Usado pelo estado do personagem, pelas fórmulas e pelos componentes de campo.

export const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function pathKeys(path, { template = false, source = false } = {}) {
  if (typeof path !== 'string' || !path) throw new Error('Caminho deve ser uma string não vazia.');
  const keys = path.split('.');
  for (const segment of keys) {
    const key = source ? segment.replace(/\[\]$/, '') : segment;
    if (!key || RESERVED_KEYS.has(key) || (!template && /[{}]/.test(key))) {
      throw new Error(`Caminho inseguro: "${path}" (segmento "${segment}").`);
    }
  }
  return keys;
}

export function getByPath(obj, path) {
  if (path == null) return undefined;
  return pathKeys(path).reduce((o, key) => (o != null && Object.hasOwn(Object(o), key) ? o[key] : undefined), obj);
}

export function setByPath(obj, path, value) {
  const keys = pathKeys(path);
  const last = keys.pop();
  const target = keys.reduce((o, key) => {
    if (!Object.hasOwn(o, key) || o[key] == null) o[key] = {};
    if (typeof o[key] !== 'object') throw new Error(`Caminho "${path}" atravessa um valor que não é objeto.`);
    return o[key];
  }, obj);
  target[last] = value;
  return obj;
}
