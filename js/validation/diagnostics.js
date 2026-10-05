export const MAX_DIAGNOSTICS = 200;
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
// Localiza por chave real (inclusive chaves literais com ponto), não por split('.') ingênuo.
export function issuePointer(document, path, root) {
  let rest = path.startsWith(root) ? path.slice(root.length).replace(/^\./, '') : path;
  let value = document;
  const segments = [];
  while (rest) {
    const index = /^\[(\d+)\]/.exec(rest);
    if (index) { segments.push(index[1]); value = value?.[index[1]]; rest = rest.slice(index[0].length).replace(/^\./, ''); continue; }
    const key = value && typeof value === 'object'
      ? Object.keys(value).sort((a,b) => b.length-a.length).find(key => rest === key || rest.startsWith(`${key}.`) || rest.startsWith(`${key}[`)) : null;
    const token = key || /^[^.\[]+/.exec(rest)?.[0];
    if (!token) break;
    segments.push(token); value = value?.[token]; rest = rest.slice(token.length).replace(/^\./, '');
  }
  return segments.length ? `/${segments.map(escape).join('/')}` : '';
}
export function diagnosticsFor(issues, document, kind, root = kind) {
  const unique = new Map();
  for (const issue of issues) {
    const result = { ...issue, severity: issue.severity || 'error', document: { kind, ...(document?.id || document?.meta?.id ? {id: document.id || document.meta.id} : {}) }, pointer: issuePointer(document, issue.path, root) };
    unique.set(JSON.stringify([result.path,result.message,result.severity]), result);
  }
  const all = [...unique.values()];
  return all.length > MAX_DIAGNOSTICS ? [...all.slice(0,MAX_DIAGNOSTICS-1), {severity:'error',code:'diagnostics.limit',path:root,pointer:'',document:{kind},message:'Diagnóstico interrompido: mais de 200 problemas.'}] : all;
}
