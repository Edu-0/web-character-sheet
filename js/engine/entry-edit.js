// Prepare edits against the entry's identity, preserving unrelated live changes.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function prepareEntryEdit(current, original, draft, fields) {
  if (!current || current.id !== original.id) throw new Error('Esta entrada foi removida ou substituída. Feche a edição e confira a ficha.');
  const next = structuredClone(current);
  for (const key of fields) {
    if (['id', '__proto__', 'prototype', 'constructor'].includes(key)) continue;
    if (equal(original[key], draft[key]) && Object.hasOwn(original, key) === Object.hasOwn(draft, key)) continue;
    if (!equal(current[key], original[key]) || Object.hasOwn(current, key) !== Object.hasOwn(original, key)) {
      throw new Error('Um campo editado também mudou na ficha. Suas alterações continuam nesta janela; cancele e reabra para usar a versão atual.');
    }
    if (Object.hasOwn(draft, key)) next[key] = structuredClone(draft[key]);
    else delete next[key];
  }
  return next;
}
