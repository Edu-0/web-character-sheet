import {insertionPlan} from './composition-commands.js';
import {recipeControls} from './recipe-controls.js';
import {getByPath} from '../engine/paths.js';
import {el} from './authoring-dom.js';

export const DND_STATS={proficiency:'Bônus de proficiência',initiative:'Iniciativa',passivePerception:'Percepção passiva',spellSaveDC:'Dificuldade das magias',spellAttackBonus:'Ataque mágico',totalInventoryWeight:'Peso total do inventário',carryCapacity:'Capacidade de carga'};
export function dndRecipePlan(pkg,{type,name,destination,key,stat}){
 const template=pkg.system.characterTemplate;
 if(!template.identity||!Number.isFinite(template.identity.level)||!template.abilities||!template.skills||!template.combat||!template.inventory)throw new Error('Esta família usa os dados específicos de D&D. Abra uma cópia do pacote D&D pelo fluxo Sistemas antes de incluir; nenhum campo será inventado.');
 let component;
 if(type==='dndAbility'){const ability=pkg.system.abilities?.find(a=>a.key===key);if(!ability||!Number.isFinite(getByPath(template,'abilities.'+key+'.score')))throw new Error('Escolha um atributo existente no catálogo e no template D&D.');component={type,field:'abilities.'+key+'.score',key,short:ability.short,label:name||ability.label};}
 else if(type==='dndSkill'){const skill=pkg.system.skills?.find(s=>s.key===key);if(!skill||!pkg.system.abilities?.some(a=>a.key===skill.ability)||typeof getByPath(template,'skills.'+key+'.proficient')!=='boolean')throw new Error('Escolha uma perícia com atributo e dados compatíveis no pacote D&D.');component={type,field:'skills.'+key+'.proficient',key,ability:skill.ability,label:name||skill.label};}
 else if(type==='dndDerived'){if(!Object.hasOwn(DND_STATS,stat))throw new Error('Escolha um dos derivados existentes de D&D.');component={type,stat,label:name||DND_STATS[stat]};}
 else throw new Error('Família D&D desconhecida.');
 const plan=insertionPlan(pkg,{type,name:name||component.label,destination,prototype:component});plan.dependencies=['Compartilha os dados e cálculos específicos do pacote D&D; não amplia a automação do livro.','A ficha estática, modular e comparação continuam usando os mesmos dados.'];return plan;
}
export function mountDndRecipe(host,{pkg,type,state={},notify}){
 const c=recipeControls(host,state,notify);let key=()=>'',stat=()=>'';
 if(type==='dndAbility')key=c.select('Atributo D&D do catálogo','key',[['','Escolha um atributo'],...(pkg.system.abilities||[]).map(a=>[a.key,a.label])]);
 else if(type==='dndSkill')key=c.select('Perícia D&D do catálogo','key',[['','Escolha uma perícia'],...(pkg.system.skills||[]).map(s=>[s.key,s.label])]);
 else stat=c.select('Resultado derivado D&D','stat',Object.entries(DND_STATS),'proficiency');
 host.append(el('p','Componentes D&D dependem da estrutura própria de atributos, perícias, combate, inventário e nível. Use uma cópia do pacote D&D em Sistemas para conservar referências e dados. Estes controles configuram os mecanismos atuais; não automatizam o livro inteiro.','editor-note'));
 return ({name,destination})=>dndRecipePlan(pkg,{type,name,destination,key:key(),stat:stat()});
}
