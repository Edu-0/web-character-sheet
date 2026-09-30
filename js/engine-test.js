// engine-test.js
// Prova arquitetural (fase 8): carrega um sistema fictício, completamente diferente
// de D&D, através dos mesmos módulos genéricos da engine — nenhum deles conhece
// "fictional-test" ou "dnd2024" especificamente.
import { loadSystem, resolveFormula } from './engine/system.js';
import { loadLayout, getPages } from './engine/layout.js';
import { renderPage } from './engine/renderer.js';
import { resolve } from './engine/dice-resolver.js';
import './engine/fields.js';

async function main() {
  const system = await loadSystem('./data/systems/fictional-test.system.json');
  await loadLayout('./data/systems/fictional-test.layout.json');
  const character = await fetch('./data/characters/fictional-test.character.json').then((r) => r.json());

  const root = document.getElementById('engine-root');
  const [page] = getPages();

  const rerenderFormulas = () => updateFormulas(character);
  renderPage(root, page, character, { onChange: rerenderFormulas });
  rerenderFormulas();

  document.getElementById('btn-roll-pool').addEventListener('click', () => {
    const result = resolve({ type: 'dicePool', dice: system.dicePools.actionPool.dice, label: 'Pool de Ação' });
    document.getElementById('pool-result').textContent =
      `${result.formula} → [${result.rolls.map((r) => r.result).join(', ')}] = ${result.total}`;
  });
}

function updateFormulas(character) {
  const abilityMod = resolveFormula('abilityModifier', { value: character.attributes.attributeA });
  const skillBonus = resolveFormula('customSkillBonus', {
    abilityModifier: abilityMod,
    trained: Boolean(character.customSkillTrained),
  });
  document.getElementById('formula-output').textContent =
    `abilityModifier(Atributo A = ${character.attributes.attributeA}) = ${abilityMod}\n` +
    `customSkillBonus (treinado = ${character.customSkillTrained}) = ${skillBonus}`;
}

main().catch((err) => {
  document.getElementById('engine-root').textContent = `Erro: ${err.message}`;
  console.error(err);
});
