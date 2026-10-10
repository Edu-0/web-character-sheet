import {insertionPlan} from './composition-commands.js';
import {valueAt,destinations} from './form-structure.js';
import {generatedKey} from './data-index.js';
import {pointerFor} from './source-map.js';
export const TOOLBOX_GROUPS=[
 ['Textos',[['text','Texto curto'],['textarea','Texto longo']]],
 ['Elementos',[['number','Número'],['boolean','Sim / Não'],['select','Escolha'],['resource','Recurso'],['counter','Contador'],['die','Dado'],['image','Imagem']]],
 ['Caixas',[['section','Seção'],['container','Coluna'],['container-grid','Grade'],['container-flex','Linha flexível']]],
 ['Coleções',[['list','Lista de registros'],['table','Tabela'],['tagList','Marcadores'],['stateList','Estados'],['slotTracker','Usos'],['skillCatalog','Perícias']]],
 ['Cálculos',[['computed','Cálculo'],['inventorySummary','Carga']]],
 ['Regras',[['checkRoll','Teste'],['actionGroup','Ação'],['recoveryGroup','Recuperação'],['effectList','Efeito'],['traitAllocation','Distribuição'],['pointBudget','Criação e evolução'],['repertoire','Repertório'],['poolBuilder','Pool'],['techniqueUse','Técnicas']]],
 ['D&D',[['dndAbility','Atributo D&D'],['dndSkill','Perícia D&D'],['dndDerived','Derivado D&D']]],
];
export const tileName=type=>TOOLBOX_GROUPS.flatMap(([,cards])=>cards).find(([key])=>key===type)?.[1]||type;
export const tileKind=type=>type==='section'?'section':type.startsWith('container')?'container':'component';
const simple=new Set(['text','textarea','number','boolean','resource','counter','die','image','tagList','list','table']);
export function canvasInsertionPlan(pkg,{type,destination,index}){
 const kind=tileKind(type),array=valueAt(pkg,destination);
 if(!Array.isArray(array)||!destinations(pkg,kind).some(d=>pointerFor(d.path)===pointerFor(destination)))throw Error('Escolha uma posição compatível na ficha.');
 const at=Math.max(0,Math.min(index??array.length,array.length));
 if(kind!=='component'){
  const seed=insertionPlan(pkg,{type:'text',name:'Texto curto',destination:destinations(pkg,'component')[0]?.path,hasInitial:true,initial:''});
  const components=[seed.commands.at(-1).value];
  const value=kind==='section'?{id:generatedKey('seção',array.map(v=>v.id)),title:'Nova seção',containers:[{layout:{type:'stack'},components}]}:{layout:{type:type==='container-grid'?'grid':type==='container-flex'?'flex':'stack'},components};
  return {commands:[...seed.commands.slice(0,-1),{type:'insertNode',path:destination,index:at,value}],selection:[...destination,at],dependencies:[...seed.dependencies,'Caixa com um campo de texto inicial, conforme o contrato atual de componentes não vazios.']};
 }
 if(!simple.has(type))return null;
 const initial=type==='resource'?{current:0,max:0}:type==='boolean'?false:['number','counter','die'].includes(type)?0:'';
 const plan=insertionPlan(pkg,{type,name:tileName(type),destination,hasInitial:!['list','table','tagList'].includes(type),initial});
 const insert=plan.commands.at(-1);insert.index=at;plan.selection=[...destination,at];return plan;
}
