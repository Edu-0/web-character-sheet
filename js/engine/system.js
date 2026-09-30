// engine/system.js
// Carrega e expõe o "system.json": a definição de como um RPG funciona
// (atributos, perícias, dados, fórmulas). A engine nunca assume D&D — tudo
// que é regra de sistema vive aqui, vindo do JSON carregado em runtime.
import { evaluate } from './formula.js';

let currentSystem = null;

export async function loadSystem(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar o sistema (${url}): HTTP ${res.status}`);
  currentSystem = await res.json();
  return currentSystem;
}

export function setSystem(system) {
  currentSystem = system;
  return currentSystem;
}

export function getSystem() {
  return currentSystem;
}

export function getAbilities() {
  return currentSystem?.abilities ?? [];
}

export function getSkills() {
  return currentSystem?.skills ?? [];
}

export function getDiceSet() {
  return currentSystem?.diceSet ?? [];
}

export function getResourceDef(key) {
  return currentSystem?.resources?.[key];
}

export function getFormula(key) {
  return currentSystem?.formulas?.[key];
}

/**
 * Resolve uma fórmula nomeada do system.json atual contra um conjunto de variáveis.
 * Retorna undefined se o sistema não definir essa fórmula (permite que sistemas
 * diferentes tenham conjuntos de fórmulas completamente distintos).
 */
export function resolveFormula(key, vars = {}, data = null) {
  const expression = getFormula(key);
  if (expression == null) return undefined;
  return evaluate(expression, { vars, data });
}
