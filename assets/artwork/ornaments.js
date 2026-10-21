// Catálogo de arte decorativa. Direitos das artes separados da licença da engine.
import { DICE_PATHS } from './book-vectors.js';

const die = (sides, x, y, scale) => `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${DICE_PATHS[sides]}" stroke-width="5"/></g>`;
const sprig = '<path d="M18 85Q70 80 116 18M45 78Q28 48 58 58Q66 70 45 78M66 66Q83 81 93 55Q79 49 66 66M83 46Q65 25 93 28Q103 35 83 46M99 30Q121 39 125 15Q110 13 99 30"/>';
const petals = '<path d="M120 50C93 32 105 8 120 27C135 8 147 32 120 50C147 32 165 53 142 61C154 84 127 96 120 70C113 96 86 84 98 61C75 53 93 32 120 50Z"/><circle cx="120" cy="53" r="8"/>';
// Original geometric drawings for the interface; no external art or shared SVG IDs.
const prideColors = ['#e44852','#f89a43','#f6d957','#56b87a','#529fe0','#a17bd5'];
const transColors = ['#5bcefa','#f5a9b8','#ffffff','#f5a9b8','#5bcefa'];
const prideArc = prideColors.map((color,i)=>`<path d="M${40+i*8} 84A${80-i*8} ${74-i*8} 0 0 1 ${200-i*8} 84" stroke="${color}" stroke-width="5"/>`).join('');
const transWaves = transColors.map((color,i)=>`<path d="M24 ${26+i*12}Q72 ${10+i*12} 120 ${26+i*12}T216 ${26+i*12}" stroke="${color}" stroke-width="5"/>`).join('');

export const ORNAMENT_FAMILIES = [
  { id: 'dice', label: 'Dados e facetas' },
  { id: 'botanical', label: 'Botânico' },
  { id: 'arcane', label: 'Geométrico e arcano' },
  { id: 'pride', label: 'LGBT · Orgulho' },
  { id: 'trans', label: 'Trans' },
  { id: 'blood', label: 'Sangue e espinhos' },
  { id: 'eldritch', label: 'Horror cósmico' },
  { id: 'scifi', label: 'Sci-fi' },
  { id: 'parchment', label: 'Pergaminho' },
  { id: 'ocean', label: 'Oceano' },
  { id: 'solarpunk', label: 'Solarpunk' },
  { id: 'frutiger-aero', label: 'Frutiger Aero' },
];

export const ORNAMENT_POSITIONS = [
  { id: 'left', label: 'Topo à esquerda' },
  { id: 'center', label: 'Topo ao centro' },
  { id: 'right', label: 'Topo à direita' },
];

export const ORNAMENTS = [
  { id: 'frutiger-aero-bubbles', family: 'frutiger-aero', label: 'Bolhas de vidro', position: 'left', drawing: '<circle cx="82" cy="53" r="34" fill="#64bce3" fill-opacity=".18"/><circle cx="150" cy="34" r="21" fill="#8cd8ef" fill-opacity=".15"/><circle cx="185" cy="72" r="12" fill="#b5ebf8" fill-opacity=".2"/><path d="M59 49A25 25 0 0 1 79 29M137 32A14 14 0 0 1 149 21M179 70L183 66" stroke="#f0fcff" stroke-width="3"/>' },
  { id: 'frutiger-aero-globe', family: 'frutiger-aero', label: 'Planeta azul', position: 'center', drawing: '<circle cx="112" cy="51" r="36" fill="#64bce3" fill-opacity=".18"/><ellipse cx="112" cy="51" rx="16" ry="36"/><path d="M77 51H147M83 31Q112 42 141 31M83 71Q112 60 141 71M87 35Q92 24 105 22"/><path d="M143 72Q139 44 181 36Q192 69 143 72Z" fill="#91c65c" fill-opacity=".65"/><path d="M138 78L173 45M153 63V52M162 55L174 59"/>' },
  { id: 'frutiger-aero-leaf', family: 'frutiger-aero', label: 'Água e natureza', position: 'right', drawing: '<path d="M105 13C94 35 77 50 77 65A28 24 0 0 0 133 65C133 50 116 35 105 13Z" fill="#64bce3" fill-opacity=".24"/><path d="M88 59Q83 72 97 78" stroke="#f0fcff" stroke-width="3"/><path d="M132 65Q129 24 184 16Q199 64 132 65Z" fill="#91c65c" fill-opacity=".65"/><path d="M126 72L178 24M147 51L148 34M158 40L177 46M37 81Q57 70 70 81M146 84Q165 73 188 84"/>' },
  { id: 'parchment-quill', family: 'parchment', label: 'Pena e tinta', position: 'left', drawing: '<path d="M64 83L153 13Q187 3 173 34L95 74ZM84 64L93 38L113 48M112 43L120 24L133 32M130 29L153 13M39 86H124M166 70H200L207 89H159ZM175 61H192V70"/>' },
  { id: 'parchment-book', family: 'parchment', label: 'Livro de aventuras', position: 'center', drawing: '<path d="M120 28Q86 9 52 22V77Q87 66 120 85Q153 66 188 77V22Q154 9 120 28V85M64 35Q88 27 106 38M64 49Q88 41 106 52M64 63Q88 55 106 66M134 38Q153 27 176 35M134 52Q153 41 176 49M134 66Q153 55 176 63M26 50H41M199 50H214"/>' },
  { id: 'parchment-scroll', family: 'parchment', label: 'Iluminura', position: 'right', drawing: '<path d="M25 50H215M66 50Q39 17 70 14Q93 14 81 33Q67 46 58 29M174 50Q201 17 170 14Q147 14 159 33Q173 46 182 29M66 50Q39 83 70 86Q93 86 81 67Q67 54 58 71M174 50Q201 83 170 86Q147 86 159 67Q173 54 182 71M120 27L139 50L120 73L101 50Z"/>' },
  { id: 'ocean-wave', family: 'ocean', label: 'Ondas', position: 'left', drawing: '<path d="M16 66Q43 39 70 66T124 66T178 66T232 66M16 83Q43 56 70 83T124 83T178 83T232 83M83 48C111 -1 159 9 146 37Q126 18 112 42Q135 47 151 48"/>' },
  { id: 'ocean-compass', family: 'ocean', label: 'Rosa dos ventos', position: 'center', drawing: '<circle cx="120" cy="50" r="32"/><path d="M120 5L131 39L165 50L131 61L120 95L109 61L75 50L109 39ZM120 22V78M92 50H148M61 50H39M179 50H201M91 21L84 14M149 21L156 14M91 79L84 86M149 79L156 86"/>' },
  { id: 'ocean-shell', family: 'ocean', label: 'Concha', position: 'right', drawing: '<path d="M100 83L68 37Q67 18 87 23Q94 5 111 18Q120 1 129 18Q146 5 153 23Q173 18 172 37L140 83ZM87 23L108 75M111 18L116 75M129 18L124 75M153 23L132 75M96 88H144M24 72Q39 61 54 72M186 72Q201 61 216 72"/>' },
  { id: 'solarpunk-leaf', family: 'solarpunk', label: 'Folha solar', position: 'left', drawing: '<path d="M67 80Q49 21 151 17Q174 75 67 80ZM67 80L145 28M88 63L86 40M111 47L132 61M67 80L49 92M180 30V13M192 34L204 22M196 47H215"/><circle cx="181" cy="47" r="12"/>' },
  { id: 'solarpunk-sun', family: 'solarpunk', label: 'Sol e comunidade', position: 'center', drawing: '<circle cx="120" cy="42" r="22"/><path d="M120 8V2M90 15L83 8M150 15L157 8M84 42H74M156 42H166M120 27V57M105 42H135M37 89L58 66L79 89M50 89V79H66V89M161 89L182 66L203 89M174 89V79H190V89M84 89Q120 69 156 89M106 77V65M134 77V65"/>' },
  { id: 'solarpunk-canopy', family: 'solarpunk', label: 'Jardim conectado', position: 'right', drawing: '<path d="M120 91V43M120 64Q79 68 82 33Q119 28 120 64ZM120 49Q120 16 157 18Q159 50 120 49ZM29 88H211M49 88V65L74 49L99 65V88M49 72H99M62 58V88M79 54V88M150 88V70H190V88M170 70V56M170 56Q151 55 154 39Q174 39 170 56ZM170 56Q169 37 191 37Q195 56 170 56Z"/>' },
  { id: 'pride-arc', family: 'pride', label: 'Arco do orgulho', position: 'left', drawing: prideArc },
  { id: 'pride-star', family: 'pride', label: 'Estrela da diversidade', position: 'center', drawing: prideColors.map((color,i)=>`<path d="M120 14L132 38L120 50L108 38Z" transform="rotate(${i*60} 120 50)" stroke="${color}" stroke-width="3"/>`).join('')+'<circle cx="120" cy="50" r="9"/>' },
  { id: 'pride-ribbon', family: 'pride', label: 'Laço do orgulho', position: 'right', drawing: prideColors.map((color,i)=>`<path d="M24 ${30+i*8}Q70 ${10+i*8} 120 ${30+i*8}T216 ${30+i*8}" stroke="${color}" stroke-width="4"/>`).join('') },
  { id: 'trans-waves', family: 'trans', label: 'Faixa trans', position: 'left', drawing: transWaves },
  { id: 'trans-orbit', family: 'trans', label: 'Órbita trans', position: 'center', drawing: '<circle cx="120" cy="50" r="32" stroke="#5bcefa" stroke-width="4"/><ellipse cx="120" cy="50" rx="72" ry="19" transform="rotate(-18 120 50)" stroke="#f5a9b8" stroke-width="4"/><path d="M120 35L128 50L120 65L112 50Z" stroke="#ffffff" stroke-width="3"/>' },
  { id: 'trans-wings', family: 'trans', label: 'Asas trans', position: 'right', drawing: transColors.map((color,i)=>`<path d="M120 78Q${72-i*9} ${62-i*9} ${48-i*5} ${22+i*9}M120 78Q${168+i*9} ${62-i*9} ${192+i*5} ${22+i*9}" stroke="${color}" stroke-width="3"/>`).join('') },
  { id: 'blood-drop', family: 'blood', label: 'Gota rubra', position: 'left', drawing: '<path d="M120 9C106 34 87 49 87 66A33 27 0 0 0 153 66C153 49 134 34 120 9Z"/><path d="M105 64Q102 77 117 81M34 50H70M170 50H206M53 41L65 50L53 59M187 41L175 50L187 59"/>' },
  { id: 'blood-seal', family: 'blood', label: 'Selo carmesim', position: 'center', drawing: '<circle cx="120" cy="50" r="37"/><path d="M120 4V16M120 84V96M74 50H86M154 50H166M120 21L143 50L120 79L97 50ZM109 45H131M120 32V69M42 44Q26 64 42 72Q58 64 42 44ZM198 44Q182 64 198 72Q214 64 198 44Z"/>' },
  { id: 'blood-thorns', family: 'blood', label: 'Espinhos rubros', position: 'right', drawing: '<path d="M20 75Q65 28 120 62T220 34M44 56L36 28L61 43M79 45L80 20L96 47M126 64L134 89L146 67M171 62L175 35L188 50M205 48L224 62L216 36"/>' },
  { id: 'eldritch-eye', family: 'eldritch', label: 'Olho do abismo', position: 'center', drawing: '<path d="M35 50Q120 -7 205 50Q120 107 35 50ZM96 50A24 24 0 0 0 144 50A24 24 0 0 0 96 50ZM120 33L127 50L120 67L113 50ZM75 27Q44 6 29 26M75 73Q44 94 29 74M165 27Q196 6 211 26M165 73Q196 94 211 74"/>' },
  { id: 'eldritch-tendrils', family: 'eldritch', label: 'Tentáculos', position: 'left', drawing: '<path d="M20 85C67 85 38 7 89 16C132 24 65 70 120 77C162 83 141 7 185 17C215 24 171 60 221 49M20 94C84 98 57 22 88 25M122 86C177 96 155 22 184 26"/><circle cx="63" cy="61" r="3"/><circle cx="70" cy="44" r="3"/><circle cx="161" cy="62" r="3"/><circle cx="168" cy="43" r="3"/>' },
  { id: 'eldritch-portal', family: 'eldritch', label: 'Portal impossível', position: 'right', drawing: '<path d="M120 7L163 29L174 66L139 91L91 83L67 46L91 16ZM120 21L151 36L158 62L134 77L102 71L84 47L99 30ZM102 71L120 43L151 36M84 47L134 77M99 30L158 62M120 7V21M174 66L158 62M91 83L102 71M27 50H49M192 50H214"/>' },
  { id: 'scifi-circuit', family: 'scifi', label: 'Circuitos', position: 'left', drawing: '<path d="M20 25H72L93 46H147L168 25H220M20 76H59L83 53M157 53L181 76H220M120 20V80"/><circle cx="20" cy="25" r="5"/><circle cx="20" cy="76" r="5"/><circle cx="220" cy="25" r="5"/><circle cx="220" cy="76" r="5"/><circle cx="120" cy="50" r="15"/>' },
  { id: 'scifi-core', family: 'scifi', label: 'Núcleo estelar', position: 'center', drawing: '<path d="M120 10L154 30V70L120 90L86 70V30ZM120 25L142 38V62L120 75L98 62V38ZM120 35V65M105 50H135M60 20L79 32M60 80L79 68M161 32L180 20M161 68L180 80M42 50H77M163 50H198"/><circle cx="36" cy="50" r="5"/><circle cx="204" cy="50" r="5"/>' },
  { id: 'scifi-orbit', family: 'scifi', label: 'Mapa orbital', position: 'right', drawing: '<circle cx="120" cy="50" r="25"/><ellipse cx="120" cy="50" rx="75" ry="34"/><path d="M120 8V18M120 82V92M18 50H42M198 50H222M100 42H140M106 57H134"/><circle cx="52" cy="36" r="6"/><circle cx="182" cy="70" r="5"/>' },
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
  { id: 'frutiger-aero', label: 'Frutiger Aero', selected: [{id:'frutiger-aero-bubbles',position:'left'},{id:'frutiger-aero-globe',position:'center'},{id:'frutiger-aero-leaf',position:'right'}] },
  { id: 'parchment', label: 'Pergaminho', selected: [{id:'parchment-quill',position:'left'},{id:'parchment-book',position:'center'},{id:'parchment-scroll',position:'right'}] },
  { id: 'ocean', label: 'Oceano', selected: [{id:'ocean-wave',position:'left'},{id:'ocean-compass',position:'center'},{id:'ocean-shell',position:'right'}] },
  { id: 'solarpunk', label: 'Solarpunk', selected: [{id:'solarpunk-leaf',position:'left'},{id:'solarpunk-sun',position:'center'},{id:'solarpunk-canopy',position:'right'}] },
  { id: 'pride', label: 'Orgulho', selected: [{id:'pride-arc',position:'left'},{id:'pride-star',position:'center'},{id:'pride-ribbon',position:'right'}] },
  { id: 'trans', label: 'Trans', selected: [{id:'trans-waves',position:'left'},{id:'trans-orbit',position:'center'},{id:'trans-wings',position:'right'}] },
  { id: 'blood', label: 'Sangue', selected: [{id:'blood-drop',position:'left'},{id:'blood-seal',position:'center'},{id:'blood-thorns',position:'right'}] },
  { id: 'eldritch', label: 'Horror cósmico', selected: [{id:'eldritch-tendrils',position:'left'},{id:'eldritch-eye',position:'center'},{id:'eldritch-portal',position:'right'}] },
  { id: 'scifi', label: 'Sci-fi', selected: [{id:'scifi-circuit',position:'left'},{id:'scifi-core',position:'center'},{id:'scifi-orbit',position:'right'}] },
  { id: 'adventure', label: 'Aventura', selected: [{ id: 'dice-pair', position: 'left' }, { id: 'dice-orbit', position: 'right' }] },
  { id: 'garden', label: 'Jardim arcano', selected: [{ id: 'botanical-sprig', position: 'left' }, { id: 'botanical-petals', position: 'center' }, { id: 'arcane-orbits', position: 'right' }] },
  { id: 'minimal', label: 'Minimalista', selected: [{ id: 'arcane-facets', position: 'center' }] },
];
