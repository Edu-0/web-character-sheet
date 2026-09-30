// engine/die-scale.js
// Mecanismo genérico de "escala de dados configurável" (ex: d4→d6→d8→d10→d12).
// Nenhum valor da escala é fixo no código — vem de system.json (getDieScale()).
// Serve tanto para Aprimorar/Reduzir Traços quanto para custos de melhoria.
import { getSystem } from './system.js';

export function getDieScale() {
  return getSystem()?.dieScale ?? [];
}

/**
 * Sobe um degrau na escala. Se já estiver no topo, não existe "próximo dado"
 * (o sistema não inventa d14) — retorna overflow:true para o chamador decidir
 * o que fazer (ex.: converter em Traço Composto ou em "Ascensão", conforme a regra).
 */
export function stepUp(sides) {
  const scale = getDieScale();
  const index = scale.indexOf(sides);
  if (index === -1) return { sides, overflow: false, unknown: true };
  if (index === scale.length - 1) return { sides, overflow: true };
  return { sides: scale[index + 1], overflow: false };
}

/**
 * Desce um degrau. O piso da escala nunca desaparece (ex.: Reduzir abaixo de
 * d4 continua em d4) — retorna floored:true quando isso acontece.
 */
export function stepDown(sides) {
  const scale = getDieScale();
  const index = scale.indexOf(sides);
  if (index === -1) return { sides, floored: false, unknown: true };
  if (index === 0) return { sides, floored: true };
  return { sides: scale[index - 1], floored: false };
}

/**
 * Custo de subir de um dado para outro usando uma tabela de custos configurável
 * (ex.: system.json → improvementCosts.skills). Retorna undefined (não inventa
 * valor) quando a transição não estiver definida na tabela.
 */
export function upgradeCost(fromSides, toSides, costTable) {
  const key = `${fromSides}->${toSides}`;
  return costTable?.[key];
}
