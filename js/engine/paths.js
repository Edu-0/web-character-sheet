// engine/paths.js
// Utilitário genérico de leitura/escrita por caminho pontilhado (ex: "abilities.str.score").
// Usado pelo estado do personagem, pelas fórmulas e pelos componentes de campo.

export function getByPath(obj, path) {
  return path.split('.').reduce((o, key) => (o == null ? undefined : o[key]), obj);
}

export function setByPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, key) => {
    if (o[key] == null) o[key] = {};
    return o[key];
  }, obj);
  target[last] = value;
  return obj;
}
