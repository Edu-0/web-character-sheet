import { RESERVED_KEYS, pathKeys } from '../engine/paths.js';

export const LIMITS = Object.freeze({ characterBytes: 2 * 1024 ** 2, systemBytes: 4 * 1024 ** 2, backupBytes: 32 * 1024 ** 2, depth: 32, nodes: 100000, items: 10000, string: 100000 });

// Percurso iterativo: a própria checagem não pode estourar a pilha.
export function inspectJson(value, root = 'document', { maxString = LIMITS.string, maxNodes = LIMITS.nodes, maxDepth = LIMITS.depth } = {}) {
  const stack = [{ value, path: root, depth: 0 }];
  const seen = new Set();
  let nodes = 0;
  while (stack.length) {
    const item = stack.pop();
    if (++nodes > maxNodes) return [{ path: item.path, message: `excede o limite de ${maxNodes} valores` }];
    if (item.depth > maxDepth) return [{ path: item.path, message: `excede a profundidade ${maxDepth}` }];
    if (typeof item.value === 'string' && item.value.length > maxString) return [{ path: item.path, message: `excede ${maxString} caracteres` }];
    if (typeof item.value === 'number' && !Number.isFinite(item.value)) return [{ path: item.path, message: 'deve ser um número finito' }];
    if (item.value && typeof item.value === 'object') {
      if (seen.has(item.value)) return [{ path: item.path, message: 'referência circular ou compartilhada não permitida em JSON' }];
      seen.add(item.value);
      const entries = Object.entries(item.value);
      if (entries.length > LIMITS.items) return [{ path: item.path, message: `excede ${LIMITS.items} entradas` }];
      for (const [key, child] of entries) {
        const path = Array.isArray(item.value) ? `${item.path}[${key}]` : `${item.path}.${key}`;
        if (!key || RESERVED_KEYS.has(key)) return [{ path, message: 'chave vazia ou reservada não permitida' }];
        const catalog = root === 'system' || item.path.startsWith('package.system.') || /^backup.systems\[\d+\]\.system\./.test(item.path);
        if (key === 'key' && typeof child === 'string' && (RESERVED_KEYS.has(child) || catalog && (child.includes('.') || !child))) return [{path, message:'chave de catálogo vazia, reservada ou com ponto não permitida'}];
        if (key.length > LIMITS.string) return [{ path: item.path, message: 'nome de chave demasiado longo' }];
        if (typeof child === 'string' && (key === 'field' || /(?:Field|From)$/.test(key) || key === 'collection' || key === 'source' && item.path.endsWith('.repeat'))) {
          try { pathKeys(child, { template: true, source: true }); }
          catch (error) { return [{ path, message: error.message }]; }
        }
        // Retratos legados não são recomprimidos: Data URLs têm orçamento de bytes do arquivo.
        const image = typeof child === 'string' && /^data:image\//i.test(child);
        if (root === 'backup' && key === 'raw' && item.path.startsWith('backup.recovery[') && typeof child === 'string') {
          if (child.length > LIMITS.backupBytes) return [{path, message: 'recuperação excede 32 MiB'}];
          continue;
        }
        if (image && child.length > LIMITS.systemBytes) return [{path, message:'imagem excede 4 MiB em Data URL'}];
        if (image) { if (++nodes > maxNodes) return [{path,message:'excede o limite de valores'}]; continue; }
        stack.push({ value: child, path, depth: item.depth + 1 });
      }
    }
  }
  return [];
}

export async function readJsonFile(file, maxBytes, root) {
  if (!file || file.size > maxBytes) throw new Error(`${root}: arquivo excede ${(maxBytes / 1024 ** 2).toFixed(0)} MiB.`);
  let value;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error(`${root}: o arquivo não contém JSON válido ou não pôde ser lido.`); }
  const issues = inspectJson(value, root, { maxNodes: root === 'backup' ? 1000000 : LIMITS.nodes, maxDepth: root === 'backup' ? LIMITS.depth + 3 : LIMITS.depth });
  if (issues.length) throw new Error(`${issues[0].path}: ${issues[0].message}`);
  return value;
}
