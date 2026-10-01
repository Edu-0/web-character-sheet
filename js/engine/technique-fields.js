import { registerFieldType } from './fields.js';
import { getByPath, setByPath } from './paths.js';
import { traitDescriptor, traitMaximum, shiftTrait } from './traits.js';
import { rollPool, potencyOptions } from './pool.js';
import { stepUp } from './die-scale.js';
import { renderActorPoolResult, renderResolution } from './advanced-fields.js';

// Receita de teste + consumo de recurso. Modos, campos e consequências vêm do
// JSON; o componente pode representar Técnicas, Magias ou outras capacidades.
registerFieldType('techniqueUse', {
  render(container, context) {
    const config = getByPath(context.system, context.configFrom);
    const wrap = node('div', 'engine-technique-use');
    const controls = node('div', 'engine-budget__controls');
    const technique = document.createElement('select');
    const specialization = document.createElement('select');
    const attribute = document.createElement('select');
    const mode = document.createElement('select');
    const usedDie = document.createElement('select');
    const originalDie = document.createElement('select');
    (getByPath(context.system, config.attributesFrom) || []).forEach((item) => attribute.appendChild(option(item.key, item.label)));
    config.modes.forEach((item) => mode.appendChild(option(item.id, item.label)));
    (context.system.dieScale || []).forEach((sides) => {
      usedDie.appendChild(option(String(sides), `d${sides}`));
      originalDie.appendChild(option(String(sides), `d${sides}`));
    });
    originalDie.value = '6';
    controls.append(label('Técnica a utilizar', technique), label('Especialização do teste', specialization), label('Atributo do teste', attribute), label('Modo de uso', mode), label('Dado escolhido para uso', usedDie), label('Dado original (técnica não aprendida)', originalDie));
    const status = node('p', 'engine-callout');
    status.setAttribute('role', 'status');
    const roll = button('Usar e rolar');
    const result = node('div', 'engine-pool__result');
    const potency = document.createElement('select');
    potency.setAttribute('aria-label', 'Potência');
    const opposition = document.createElement('select');
    opposition.appendChild(option('', 'Peso manual'));
    (context.system.opposition?.passivePresets || []).forEach((item) => opposition.appendChild(option(item.id, item.label)));
    const manual = document.createElement('input');
    manual.type = 'number';
    const resolve = button('Resolver uso');
    const resolution = node('div', 'engine-pool__resolution');
    let actor = null;
    let signature = '';
    let rolledMode = null;
    let rolledTechnique = null;
    let rolledDie = null;
    const currentTechnique = () => (getByPath(context.character, config.techniquesField) || []).find((item) => item.id === technique.value);
    const currentSpecialization = () => (getByPath(context.character, config.specializationsField) || []).find((item) => item.id === specialization.value);
    const currentMode = () => config.modes.find((item) => item.id === mode.value);
    const activeConcentration = () => (getByPath(context.character, config.concentrationField) || []).find((item) => item.techniqueId === technique.value);
    const energyCost = () => {
      const item = currentTechnique();
      const rule = currentMode();
      if (rule.free) return 0;
      if (item?.energyCost != null && item.energyCost !== '') return Number(item.energyCost);
      const die = rule.energyFrom === 'specialization' ? traitMaximum(currentSpecialization()?.die) : rule.energyFrom === 'original' ? Number(item?.maxDie || originalDie.value) : Number(usedDie.value);
      return getByPath(context.system, config.costsFrom)?.[die];
    };
    const updateStatus = () => {
      const rule = currentMode();
      const cost = energyCost();
      usedDie.disabled = rule.techniqueFrom === 'specialization' || !rule.terms.includes('technique') || rule.requiresConcentration;
      originalDie.disabled = Boolean(currentTechnique()) || rule.energyFrom !== 'original';
      status.textContent = `${rule.note || ''} Energia: ${Number.isFinite(cost) ? cost : 'defina o custo específico da capacidade'}.`;
    };
    const refresh = () => {
      const techniques = getByPath(context.character, config.techniquesField) || [];
      const specs = getByPath(context.character, config.specializationsField) || [];
      const next = JSON.stringify([techniques, specs]);
      if (next !== signature) {
        const oldTechnique = technique.value;
        const oldSpec = specialization.value;
        technique.replaceChildren(option('', 'Técnica não aprendida / teste genérico'));
        specialization.replaceChildren(option('', 'Sem Especialização'));
        techniques.forEach((item) => technique.appendChild(option(item.id, item.name || 'Técnica sem nome')));
        specs.forEach((item) => specialization.appendChild(option(item.id, item.name || 'Especialização sem nome')));
        technique.value = oldTechnique;
        specialization.value = oldSpec;
        signature = next;
      }
      updateStatus();
    };
    const resetRoll = () => { actor = null; result.replaceChildren(); resolution.replaceChildren(); resolve.disabled = false; updateStatus(); };
    technique.addEventListener('change', () => {
      const item = currentTechnique();
      if (item) {
        specialization.value = item.specializationId || '';
        usedDie.value = String(currentMode().requiresConcentration ? activeConcentration()?.die || item.maxDie : item.maxDie || context.system.dieScale?.[0]);
      }
      resetRoll();
    });
    mode.addEventListener('change', () => {
      if (currentMode().defaultAttribute) attribute.value = currentMode().defaultAttribute;
      if (currentMode().requiresConcentration && activeConcentration()) usedDie.value = String(activeConcentration().die);
      resetRoll();
    });
    [specialization, attribute, usedDie, originalDie].forEach((control) => control.addEventListener('change', resetRoll));
    roll.addEventListener('click', () => {
      try {
        const rule = currentMode();
        const item = currentTechnique();
        const spec = currentSpecialization();
        const specs = getByPath(context.character, config.specializationsField) || [];
        const value = Number(usedDie.value);
        if (rule.requiresTechnique && !item) throw new Error('Escolha uma Técnica aprendida.');
        if (rule.requiresSpecialization && !spec) throw new Error('Escolha uma Especialização aprendida.');
        if (rule.requiresConcentration && (!item?.concentration || !activeConcentration())) throw new Error('Esta Técnica não está sendo mantida em Concentração.');
        if (rule.requiresConcentration && value > activeConcentration().die) throw new Error('A manutenção não aumenta o dado da ativação original.');
        if (rule.requiresTechnique && value > Number(item?.maxDie || originalDie.value)) throw new Error('O dado escolhido ultrapassa o Dado Máximo da Técnica.');
        const chosenAttribute = getByPath(context.character, `${config.attributesField}.${attribute.value}`);
        const costs = energyCost();
        if (!Number.isFinite(costs) || costs < 0) throw new Error('Informe o custo específico da Técnica para esta campanha.');
        const energy = getByPath(context.character, config.energyField);
        if (costs > (Number(energy?.current) || 0)) throw new Error('Energia insuficiente; reduza o dado de uso ou recupere o recurso.');
        const values = {
          attribute: chosenAttribute,
          specialization: spec?.die,
          technique: rule.techniqueFrom === 'specialization' ? shiftTrait(spec?.die, -(rule.reductionSteps || 0), context.system.dieScale) : value,
          skill: getByPath(context.character, `${config.skillsField}.${rule.skill || ''}`) || config.skillBaseDie,
          highestSpecialization: specs.reduce((best, current) => traitMaximum(current.die) > traitMaximum(best) ? current.die : best, null),
          constant: rule.constantDie,
        };
        const labels = { attribute: 'Atributo', specialization: 'Especialização', skill: rule.skill || 'Perícia', highestSpecialization: 'Maior Especialização', constant: 'Dado de apoio' };
        const traits = rule.terms.map((key) => ({ source: key, label: key === 'technique' ? item?.name || 'Técnica sem domínio' : rule.labels?.[key] || labels[key] || key, ...traitDescriptor(values[key]) }));
        if (traits.some((trait) => !trait.sides && !trait.dice?.length)) throw new Error('Preencha os dados necessários para este teste.');
        actor = rollPool(traits);
        rolledMode = rule;
        rolledTechnique = item ? structuredClone(item) : null;
        rolledDie = value;
        if (energy) energy.current = Math.max(0, Number(energy.current) || 0) - costs;
        setByPath(context.character, config.lastUseField, { techniqueId: item?.id || null, mode: rule.id, energyCost: costs, usedDie: value, date: new Date().toISOString() });
        context.onChange?.();
        renderActorPoolResult(result, actor, potency, context.system);
        resolution.replaceChildren();
        resolve.disabled = false;
        status.textContent = `${rule.label}: ${costs} Energia paga. O custo também se aplica em caso de falha.`;
      } catch (error) { status.textContent = error.message; }
    });
    resolve.addEventListener('click', () => {
      const outcome = renderResolution(resolution, actor, opposition.value, manual.value, potency.value, context.system);
      if (!outcome) return;
      resolve.disabled = true;
      if (outcome.success && !rolledMode.free && rolledTechnique?.concentration) {
        const active = (getByPath(context.character, config.concentrationField) || []).filter((entry) => entry.techniqueId !== rolledTechnique.id);
        active.push({ techniqueId: rolledTechnique.id, die: rolledDie });
        setByPath(context.character, config.concentrationField, active);
        context.onChange?.();
        resolution.appendChild(node('p', 'engine-callout', 'Concentração ativa. A manutenção ocupa a ação bônus; encerre-a em Recursos quando o efeito terminar.'));
      }
      const reverse = !outcome.success && (outcome.outcome === 'criticalFailure' || rolledMode.reverseOnFailure);
      if (reverse) resolution.appendChild(node('p', 'engine-callout', `Reverso: ${rolledTechnique?.reverse || 'a mesa define a consequência da capacidade tentada'}.`));
      if (!outcome.success && rolledMode.failureImpact) {
        const maximum = Math.max(...potencyOptions(actor, context.system.dieScale[0]).map((item) => item.sides));
        const improved = stepUp(maximum, context.system.dieScale);
        resolution.appendChild(node('p', 'engine-callout engine-callout--danger', `Impacto contra o personagem: ${improved.overflow ? `d${maximum} + 1 Ascensão` : `d${improved.sides}`}. A mesa define o Estado apropriado.`));
      }
    });
    const outcomeControls = node('div', 'engine-budget__controls');
    outcomeControls.append(label('Oposição do uso', opposition), label('Peso manual do uso', manual), resolve);
    wrap.append(controls, status, roll, result, outcomeControls, resolution);
    refresh();
    context.registerRefresh?.(refresh);
    container.appendChild(wrap);
  },
});

function node(tag, className = '', text = '') {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}
function option(value, text) { const element = node('option', '', text); element.value = value; return element; }
function label(text, control) { const element = node('label', 'field'); element.append(node('span', '', text), control); control.setAttribute('aria-label', text); return element; }
function button(text) { const element = node('button', 'button button--primary', text); element.type = 'button'; return element; }
