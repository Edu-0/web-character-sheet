import { rollOne } from './dice-resolver.js';
import { getByPath } from './paths.js';
import { computedValue } from './computed-values.js';
import { parseDiceExpression } from './dice-expression.js';
import { effectContribution, CHECK_UNITS } from './effects.js';

export function prepareCheck({config, character, system, checkId, sourceId, options = {}, confirmed = []}) {
  const source = checkSources(config,character,system).find(item => item.id === sourceId);
  if (!source) throw new Error('Cadastre e selecione uma fonte para rolar.');
  if (source.error) throw new Error(`${source.label}: ${source.error}`);
  const effects = effectContribution(character,system,{kind:'checkModifier',key:checkId,unit:CHECK_UNITS[config.algorithm]},{confirmed});
  const manual = options.modifier ?? 0;
  const input = { ...options, value:source.value, modifier:manual + effects.value,
    momentum:config.momentumField ? getByPath(character,config.momentumField) : 0 };
  // Exercita as mesmas guardas sem consultar o gerador aleatório.
  rollCheck(config.algorithm,input,()=>1);
  const snapshot = structuredClone({schemaVersion:1,algorithm:config.algorithm,checkId,source,options:input,manualModifier:manual,effects});
  return {source, snapshot, execute:die => ({...rollCheck(config.algorithm,input,die),snapshot})};
}

export {CHECK_ALGORITHMS} from '../validation/contracts.js';

export function integer(value, min, max, label = 'Valor') {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${label}: informe um inteiro entre ${min} e ${max}.`);
  return value;
}

// Fontes são relidas no clique; nomes editáveis nunca são caminhos executáveis.
export function collectionCheckSourceId(sourceId, itemId, index) {
  return JSON.stringify([String(sourceId),itemId == null ? 'index' : 'id',itemId ?? index]);
}
export function checkSources(config, character, system = {}) {
  return config.sources.flatMap((source, index) => {
    if (source.collection) return (getByPath(character, source.collection) || []).map((item, i) => ({
      id: collectionCheckSourceId(source.id ?? index,item.id,i), sourceId:source.id ?? String(index), itemId:item.id, label: `${source.label}: ${item.name || i + 1}`, value: getByPath(item, source.valueField),
    }));
    const entry = { id: source.id ?? String(index), sourceId:source.id ?? String(index), label: source.label };
    try {
      if (source.formula) {
        entry.value = computedValue({...source,character,system});
      } else entry.value = getByPath(character, source.field);
    } catch (error) {
      // Uma fórmula opcional indisponível não inutiliza as outras fontes.
      entry.error = error.message;
    }
    return [entry];
  });
}

// Função sem mutação. O dado injetável permite verificar limites sem aleatoriedade.
export function rollCheck(algorithm, { value, modifier = 0, target = 0, wild = true, untrained = false, momentum = 0 } = {}, die = rollOne) {
  integer(modifier, -1000, 1000, 'Modificador');
  if (['challenge', 'progress'].includes(algorithm)) {
    const progress = algorithm === 'progress';
    integer(value, 0, progress ? 40 : 10, progress ? 'Marcas de progresso' : 'Fonte');
    if (!progress) integer(momentum, -6, 10, 'Ímpeto');
    if (progress && modifier !== 0) throw new Error('Teste de progresso não usa modificador nem ímpeto.');
    const action = progress ? null : die(6);
    const cancelled = !progress && momentum < 0 && action === -momentum;
    const total = progress ? Math.floor(value/4) : Math.min(10, (cancelled ? 0 : action) + value + modifier);
    const challenges = [die(10), die(10)];
    const hits = challenges.filter(n => total > n).length;
    const outcome = ['Falha','Sucesso fraco','Sucesso forte'][hits];
    const match = challenges[0] === challenges[1];
    return { rolls: [...(progress ? [] : [action]), ...challenges], challenges, action, total, modifier: progress ? 0 : value + modifier, hits, match, cancelled,
      formula: progress ? 'progresso completo contra 2d10' : '1d6 + fonte + bônus contra 2d10', outcome,
      detail: `${progress ? `${value} marcas = ${total} caixas completas` : `Ação ${action}${cancelled ? ' cancelada por ímpeto negativo' : ''}`} · Desafios ${challenges.join(', ')}${match ? ' · Dados iguais: interprete uma reviravolta' : ''}. ${progress ? 'Sem ímpeto neste teste.' : 'Queima de ímpeto e efeitos do movimento são manuais.'}` };
  }
  if (['explodingTrait', 'explodingDamage'].includes(algorithm)) {
    let budget = 100;
    const explode = sides => {
      const rolls = []; let result;
      do {
        if (--budget < 0) throw new Error('Limite de 100 dados atingido; rolagem interrompida, sem resultado válido. Resolva na mesa.');
        result = die(sides); rolls.push(result);
      } while (result === sides);
    return { count:1, sides, rolls, total: rolls.reduce((a,b)=>a+b,0) };
    };
    if (algorithm === 'explodingDamage') {
      const expression = parseDiceExpression(value);
      const groups = expression.dice.flatMap(group => Array.from({length:group.count},()=>explode(group.sides)));
      const total = groups.reduce((sum, group)=>sum+group.total, expression.modifier + modifier);
      return { rolls: groups.flatMap(group=>group.rolls), groups, total, modifier: expression.modifier + modifier, formula: `${value} (explosivo) + ${modifier}`, outcome: 'Dano rolado',
        detail: `${groups.map(group=>`d${group.sides}: ${group.rolls.join('+')}`).join(' · ')}. Resistência, armadura, Abalado e ferimentos são resolvidos pela mesa.` };
    }
    const sides = untrained ? 4 : value;
    if (![4,6,8,10,12].includes(sides)) throw new Error('Traço: use d4, d6, d8, d10 ou d12; bônus acima de d12 vai no modificador.');
    integer(target, 1, 1000, 'Número-alvo');
    const trait = explode(sides), wildDie = wild ? explode(6) : null;
    const extraCritical = !wild && trait.rolls[0] === 1 ? die(6) : null;
    const critical = trait.rolls[0] === 1 && (wild ? wildDie.rolls[0] === 1 : extraCritical === 1);
    const total = Math.max(trait.total, wildDie?.total ?? -Infinity) + modifier - (untrained ? 2 : 0);
    const raises = critical || total < target ? 0 : Math.floor((total-target)/4);
    return { rolls: [...trait.rolls,...(wildDie?.rolls || []),...(extraCritical ? [extraCritical] : [])], total, modifier: modifier-(untrained?2:0), raises, critical,
      formula: `d${sides}${wild?' / d6 selvagem':''} explosivos`, outcome: critical ? 'Falha crítica' : total < target ? 'Falha' : raises ? `Sucesso com ${raises} ampliação(ões)` : 'Sucesso',
      detail: `Traço: ${trait.rolls.join('+')}${wild?` · Selvagem: ${wildDie.rolls.join('+')}`:''}${extraCritical?` · Confirmação Extra: ${extraCritical}`:''} · Modificador ${modifier-(untrained?2:0)} · Alvo ${target}` };
  }
  if (['d6Pool', 'd6Resistance'].includes(algorithm)) {
    integer(value, 0, 20, 'Dados da fonte');
    const count = integer(value + modifier, -20, 20, 'Quantidade final de dados');
    const rolls = Array.from({ length: count > 0 ? count : 2 }, () => die(6));
    const total = count > 0 ? Math.max(...rolls) : Math.min(...rolls);
    const critical = count > 0 && rolls.filter(n => n === 6).length > 1;
    const stress = critical ? -1 : 6 - total;
    const outcome = algorithm === 'd6Resistance' ? `Resistência · ${stress < 0 ? 'recupere 1 de estresse' : `registre ${stress} de estresse`}`
      : critical ? 'Crítico' : total === 6 ? 'Resultado pleno' : total >= 4 ? 'Resultado misto' : 'Resultado baixo';
    return { rolls, total, modifier: 0, critical, stress, formula: count > 0 ? `maior de ${count}d6` : 'menor de 2d6 (zero dados)', outcome,
      detail: `Dados: ${rolls.join(', ')}. Posição, efeito, consequências e alteração de estresse são manuais.` };
  }
  if (algorithm === 'percentile') {
    integer(value, 0, 100, 'Percentual');
    integer(modifier, -2, 2, 'Dados de bônus/penalidade');
    const units = die(10) - 1;
    const tens = Array.from({ length: 1 + Math.abs(modifier) }, () => die(10) - 1);
    const candidates = tens.map(n => n * 10 + units || 100);
    const total = modifier < 0 ? Math.max(...candidates) : Math.min(...candidates);
    const hard = Math.floor(value / 2), extreme = Math.floor(value / 5);
    const outcome = total <= extreme ? 'Grau extremo' : total <= hard ? 'Grau difícil' : total <= value ? 'Grau regular' : 'Acima do percentual';
    return { rolls: candidates, total, modifier: 0, formula: 'd100 (dezenas compartilhando a unidade)', outcome,
      detail: `Candidatos: ${candidates.join(', ')} · Regular ${value} / difícil ${hard} / extremo ${extreme}. Críticos, desastres e resultado final: confira com o Guardião.` };
  }
  if (algorithm === 'fate') {
    integer(value, -100, 100, 'Abordagem');
    integer(target, -1000, 1000, 'Oposição');
    const rolls = Array.from({ length: 4 }, () => die(3) - 2);
    const total = rolls.reduce((sum, n) => sum + n, value + modifier);
    const shifts = total - target;
    const outcome = shifts < 0 ? 'Falha' : shifts === 0 ? 'Empate' : shifts < 3 ? 'Sucesso' : 'Sucesso com estilo';
    return { rolls, total, modifier: value + modifier, formula: `4dF + ${value} + ${modifier}`, outcome,
      detail: `${rolls.map(n => n > 0 ? '+' : n < 0 ? '−' : '0').join(' ')} · Oposição ${target} · Diferença ${shifts}` };
  }
  throw new Error('Algoritmo de teste desconhecido.');
}
