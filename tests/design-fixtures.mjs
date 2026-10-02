// Dados inteiramente fictícios, compartilhados pela revisão visual e regressão.
export const longText = Array.from({ length: 65 }, (_, i) => `Registro ${i + 1}: A expedição atravessou o vale ao amanhecer. Lia anotou os caminhos, as histórias dos moradores e os cuidados com os equipamentos. Cada descoberta foi discutida com a mesa antes da próxima viagem.`).join('\n') + '\nFIM DA DESCRIÇÃO INTEGRAL.';
export function populate(character, system) {
  const name = 'Lia dos Ventos e das Montanhas Distantes — Guardiã da Biblioteca';
  if (system === 'dnd2024') {
    character.identity.name = name;
    character.identity.class = 'Patrulheira'; character.identity.level = 5;
    character.identity.portrait = portrait;
    character.combat.hpCurrent = 23; character.combat.hpMax = 38;
    character.combat.conditions = ['Envenenado'];
    character.abilities.dex.score = 18; character.skills.perception.proficient = true;
    character.features = [{ name: 'Memória da viagem', source: 'Classe', usesCurrent: 2, usesMax: 3, description: longText, notes: 'Registro preservado.' }];
    character.inventory.items = Array.from({ length: 42 }, (_, i) => ({ name: `Equipamento ${i + 1}`, qty: 1, weight: .5, value: 2, category: 'Equipamento', equipped: i === 0, notes: i === 41 ? 'ÚLTIMO ITEM DO INVENTÁRIO' : 'Material da expedição' }));
    character.spellcasting.spells = [{ name: 'Luz da jornada', level: 0, school: 'Evocação', prepared: true, castingTime: '1 ação', range: 'Toque', duration: '1 hora', components: 'V, M', description: 'Uma luz acompanha os viajantes.\nFIM DA MAGIA.' }];
    character.personality.notes = 'Anotação final da campanha.';
  } else {
    character.name = name; character.description = longText;
    character.attributes.strength = { dice: [{ sides: 12 }, { sides: 6 }] };
    character.skills.Atletismo = 8;
    character.resources.energy = { current: 7, max: 16 };
    character.resources.actionResource.current = 2;
    character.states.wear = [{ name: 'Ferido na travessia', sides: 6, temporary: false, recoverable: true, source: 'Expedição' }];
    character.progression.history = [{ id: 'example-evolution', date: '2026-10-01', description: 'Aprendizado com a cartógrafa', source: 'narrative', cost: 0 }];
    character.specializations = [{ id: 'lore', name: 'Cartografia', die: 8, techniqueIds: ['light'] }];
    character.techniques = [{ id: 'light', name: 'Luz mantida', specializationId: 'lore', maxDie: 8, currentDie: 6, concentration: true, energyCost: 2, creationPointCost: 0, effect: 'Ilumina o caminho.\nA mesa define as condições da cena.', learningSource: 'narrative' }];
    character.scene.concentrations = [{ techniqueId: 'light', die: 6 }];
    character.scene.lastTechniqueUse = { techniqueId: 'light', mode: 'trained', energyCost: 2, usedDie: 6, date: '2026-10-01' };
    character.scene.lastAction = { label: 'Descanso curto', details: ['Energia recuperada: 2'], note: 'Acampamento' };
    character.inventory = Array.from({ length: 42 }, (_, i) => ({ id: `item-${i}`, name: `Equipamento ${i + 1}`, description: i === 41 ? 'ÚLTIMO ITEM DO INVENTÁRIO' : 'Material da expedição', type: 'Equipamento', die: 6, weight: .5, quantity: 1, carried: true, properties: '', requirements: '', state: 'Conservado', range: '' }));
    character.notes = 'Anotação final da campanha.';
  }
  return character;
}
// SVG fictício gerado com primitivas, sem artes adicionais na aplicação.
export const portrait = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="120"><rect width="100" height="120" fill="#eee"/><circle cx="50" cy="38" r="22" fill="#666"/><path d="M10 115Q10 65 50 65Q90 65 90 115" fill="#555"/></svg>');
