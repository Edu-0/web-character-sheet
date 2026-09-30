// engine/resolution.js
// Resolvedor genérico de "resultado final" de uma ação: recebe o Peso do
// personagem e o Peso da oposição, calcula a Dificuldade (fórmula vinda do
// system.json), decide sucesso crítico / falha crítica / rolagem normal de d20.
// Nada aqui assume "Dificuldade = 10 + oponente - personagem" como regra fixa
// da engine — é apenas o comportamento padrão configurado no system.json de um
// sistema específico; outro sistema pode declarar outra fórmula ou registrar
// outro tipo de resolução inteiramente.
import { resolveFormula, getSystem } from './system.js';
import { rollOne } from './dice-resolver.js';

const resolutionTypes = new Map();

export function registerResolutionType(type, fn) {
  resolutionTypes.set(type, fn);
}

export function resolveAction(actorWeight, opponentWeight, options = {}) {
  const config = getSystem()?.resolution ?? {};
  const type = options.type || config.type || 'd20-above-difficulty';
  const fn = resolutionTypes.get(type);
  if (!fn) throw new Error(`Tipo de resolução desconhecido: "${type}"`);
  return fn(actorWeight, opponentWeight, config);
}

// Resolver embutido: dificuldade configurável + d20 neutro (sem bônus/vantagem),
// com limiares de sucesso/falha crítica também configuráveis.
registerResolutionType('d20-above-difficulty', (actorWeight, opponentWeight, config) => {
  const difficulty = resolveFormula(config.difficultyFormula || 'difficulty', { actorWeight, opponentWeight });
  const criticalSuccessAt = config.criticalSuccessAt ?? 0;
  const criticalFailureAt = config.criticalFailureAt ?? 20;

  if (difficulty <= criticalSuccessAt) {
    return { difficulty, rolled: false, d20: null, outcome: 'criticalSuccess', success: true };
  }
  if (difficulty >= criticalFailureAt) {
    return { difficulty, rolled: false, d20: null, outcome: 'criticalFailure', success: false };
  }
  const d20 = rollOne(20);
  const success = d20 > difficulty;
  return { difficulty, rolled: true, d20, outcome: success ? 'success' : 'failure', success };
});
