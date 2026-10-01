// engine/graded-state.js
// Mecanismo genérico para "Estados graduados representados por um dado" (ex.:
// Desgaste, Trauma, Estresse, Consequências...) que sobem quando recebem um
// efeito de determinado tamanho de dado. Reutilizável por qualquer sistema
// baseado em Traços por dado — não é específico de "Ferido".
import { stepUp } from './die-scale.js';

/**
 * currentSides: dado atual do Estado (ou null se ainda não existe).
 * effectSides: tamanho do dado do efeito recebido (ex.: a Potência de um ataque).
 *
 * Regra: efeito maior que o Estado atual -> Estado sobe direto para o dado do
 * efeito. Efeito igual -> Estado recebe 1 Aprimoramento (um degrau na escala).
 * Efeito menor -> Estado não muda.
 */
export function applyEffectToGradedState(currentSides, effectSides, scale) {
  if (currentSides == null) return { sides: effectSides, changed: true, mode: 'created' };
  if (effectSides > currentSides) return { sides: effectSides, changed: true, mode: 'raised' };
  if (effectSides === currentSides) {
    const up = stepUp(currentSides, scale);
    return { sides: up.overflow ? currentSides : up.sides, changed: true, mode: 'upgraded', ascension: up.overflow };
  }
  return { sides: currentSides, changed: false, mode: 'unchanged' };
}
