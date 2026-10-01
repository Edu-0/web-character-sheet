// Catálogo de arte decorativa. Direitos das artes separados da licença da engine.
import { DICE_PATHS } from './book-vectors.js';

const die = (sides, x, y, scale) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${DICE_PATHS[sides]}" stroke-width="5"/></g>`;
const sprig = '<path d="M18 85Q70 80 116 18M45 78Q28 48 58 58Q66 70 45 78M66 66Q83 81 93 55Q79 49 66 66M83 46Q65 25 93 28Q103 35 83 46M99 30Q121 39 125 15Q110 13 99 30"/>';
const petals = '<path d="M120 50C93 32 105 8 120 27C135 8 147 32 120 50C147 32 165 53 142 61C154 84 127 96 120 70C113 96 86 84 98 61C75 53 93 32 120 50Z"/><circle cx="120" cy="53" r="8"/>';

export const ORNAMENT_FAMILIES = [
  { id: 'dice', label: 'Dados e facetas' },
  { id: 'botanical', label: 'Botânico' },
  { id: 'arcane', label: 'Geométrico e arcano' },
];

export const ORNAMENT_POSITIONS = [
  { id: 'left', label: 'Topo à esquerda' },
  { id: 'center', label: 'Topo ao centro' },
  { id: 'right', label: 'Topo à direita' },
];

export const ORNAMENTS = [
  { id: 'dice-orbit', family: 'dice', label: 'Dado em órbita', position: 'right', drawing: '<circle cx="120" cy="50" r="44"/><path d="M48 50H72M168 50H192M120 2V8M120 92V98"/>' + die(20, 88, 18, 0.32) },
  { id: 'dice-pair', family: 'dice', label: 'Dupla de dados', position: 'left', drawing: die(6, 44, 24, 0.32) + die(12, 128, 6, 0.4) + '<path d="M26 92H215"/>' },
  { id: 'dice-trio', family: 'dice', label: 'Constelação de dados', position: 'center', drawing: die(4, 16, 37, 0.26) + die(8, 86, 4, 0.38) + die(10, 175, 33, 0.28) + '<path d="M70 57L85 41M160 41L175 57"/>' },
  { id: 'botanical-sprig', family: 'botanical', label: 'Ramos', position: 'left', drawing: sprig + '<g transform="translate(240 0) scale(-1 1)">' + sprig + '</g>' },
  { id: 'botanical-petals', family: 'botanical', label: 'Flor de pétalas', position: 'center', drawing: petals + '<path d="M20 62Q47 80 85 65M155 65Q192 80 220 62M53 69Q48 51 68 58M174 69Q181 48 194 58"/>' },
  { id: 'botanical-laurel', family: 'botanical', label: 'Coroa de folhas', position: 'right', drawing: '<path d="M112 91Q38 75 68 13M64 33Q39 12 55 10Q77 10 64 33M60 49Q32 36 36 24Q56 24 60 49M64 66Q31 61 34 45Q59 47 64 66M80 81Q52 89 44 72Q65 63 80 81"/><g transform="translate(240 0) scale(-1 1)"><path d="M112 91Q38 75 68 13M64 33Q39 12 55 10Q77 10 64 33M60 49Q32 36 36 24Q56 24 60 49M64 66Q31 61 34 45Q59 47 64 66M80 81Q52 89 44 72Q65 63 80 81"/></g>' },
  { id: 'arcane-orbits', family: 'arcane', label: 'Órbitas', position: 'right', drawing: '<circle cx="120" cy="50" r="35"/><circle cx="120" cy="50" r="44"/><ellipse cx="120" cy="50" rx="88" ry="17" transform="rotate(-15 120 50)"/><path d="M120 15L144 50L120 85L96 50Z"/><circle cx="178" cy="30" r="5"/>' },
  { id: 'arcane-stars', family: 'arcane', label: 'Constelação', position: 'center', drawing: '<path d="M24 62L68 28L118 62L170 23L214 53M68 28L75 74L118 62M170 23L175 75L214 53"/><path d="M24 53V71M15 62H33M68 19V37M59 28H77M118 53V71M109 62H127M170 14V32M161 23H179M214 44V62M205 53H223"/><circle cx="75" cy="74" r="3"/><circle cx="175" cy="75" r="3"/>' },
  { id: 'arcane-facets', family: 'arcane', label: 'Moldura de facetas', position: 'left', drawing: '<path d="M15 50H225M120 10L160 50L120 90L80 50ZM120 25L145 50L120 75L95 50ZM40 35L55 50L40 65L25 50ZM200 35L215 50L200 65L185 50Z"/>' },
];

export const ORNAMENT_PRESETS = [
  { id: 'adventure', label: 'Aventura', selected: [{ id: 'dice-pair', position: 'left' }, { id: 'dice-orbit', position: 'right' }] },
  { id: 'garden', label: 'Jardim arcano', selected: [{ id: 'botanical-sprig', position: 'left' }, { id: 'botanical-petals', position: 'center' }, { id: 'arcane-orbits', position: 'right' }] },
  { id: 'minimal', label: 'Minimalista', selected: [{ id: 'arcane-facets', position: 'center' }] },
];
