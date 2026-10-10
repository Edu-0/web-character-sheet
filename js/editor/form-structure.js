import {cachedProjection,revisionProjection} from './projection-cache.js';
import {pointerFor} from './source-map.js';
import {RESERVED_KEYS} from './operation-paths.js';

export const KIND_LABELS={package:'Pacote',system:'Sistema',layout:'Layout',tab:'Aba',section:'Seção',container:'Grupo',component:'Componente'};
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function valueAt(root,path) { let value=root;for(const key of path){if(value==null || !Object.hasOwn(Object(value),key))return undefined;value=value[key];}return value; }
export function editableDocument(session) {
  const result=session.validate();
  if(!object(result.value) || result.status==='unsupported' || result.diagnostics.some(issue=>issue.code?.startsWith('json.')))throw new Error('O texto atual não pode ser convertido sem perda. Corrija o JSON; ele permanece preservado.');
  if(!object(result.value.system))throw new Error('O sistema precisa ser um objeto para abrir formulários. Corrija este ramo no JSON; o texto atual permanece preservado.');
  return revisionProjection(result.value);
}
export function structuralNodes(pkg) {return cachedProjection(pkg,'structure',()=>buildStructuralNodes(pkg));}
function buildStructuralNodes(pkg) {
  const nodes=[];
  const add=(kind,path,title,parent=null)=>{const node={kind,path,pointer:pointerFor(path),title,parent,value:valueAt(pkg,path)};nodes.push(node);return node;};
  add('package',[],'Pacote');
  add('system',['system'],'Sistema');
  const walk=(array,path,kind,parent)=>{if(!Array.isArray(array))return;array.forEach((value,index)=>{
    const next=[...path,index],node=add(kind,next,value?.label ?? value?.title ?? value?.name ?? value?.id ?? value?.type ?? (KIND_LABELS[kind]+' '+(index+1)),parent);
    if(kind==='layout')walk(value?.tabs,[...next,'tabs'],'tab',node.pointer);
    if(kind==='tab')walk(value?.sections,[...next,'sections'],'section',node.pointer);
    if(kind==='section')walk(value?.containers,[...next,'containers'],'container',node.pointer);
    if(kind==='container')walk(value?.components,[...next,'components'],'component',node.pointer);
  });};
  walk(pkg.layouts,['layouts'],'layout',null);return nodes;
}
const children={system:'layouts',layout:'tabs',tab:'sections',section:'containers',container:'components'};
const kinds={layouts:'layout',tabs:'tab',sections:'section',containers:'container',components:'component'};
export function destinations(pkg,kind) {
  if(kind==='layout')return [{path:['layouts'],title:'Layouts'}];
  return structuralNodes(pkg).filter(node=>children[node.kind] && kinds[children[node.kind]]===kind).map(node=>({path:[...node.path,children[node.kind]],title:node.title+' · '+node.pointer}));
}
export function uniqueName(base,existing) {let name=base,index=2;while(existing.includes(name))name=base+'-'+index++;return name;}
export function safeKey(key) {if(typeof key!=='string' || !key || RESERVED_KEYS.has(key))throw new Error('Informe uma chave não vazia e não reservada.');return key;}
export function blankNode(kind,pkg,type='text') {
  const container=()=>({layout:{type:'stack'},components:[{type:'text',field:'identity.name',label:'Nome'}]});
  const section=()=>({id:'secao',title:'Nova seção',containers:[container()]});
  const tab=()=>({id:'aba',label:'Nova aba',sections:[section()]});
  if(kind==='layout')return {schemaVersion:1,id:'layout',name:'Novo layout',system:pkg.system?.id,tabs:[tab()]};
  if(kind==='tab')return tab();if(kind==='section')return section();if(kind==='container')return container();
  if(kind==='component')return {type,label:'Novo componente',...(['computed','poolBuilder','pointBudget','repertoire','actionGroup','recoveryGroup','techniqueUse','checkRoll','effectList','dndDerived'].includes(type)?{}:{field:'identity.name'})};
  throw new Error('Tipo estrutural desconhecido.');
}
export function structureCommand(pkg,node,action,{destination,to,type='text'}={}) {
  if(action==='add'){
    const key=children[node.kind];if(!key)throw new Error('Selecione o pai para adicionar.');
    const path=node.kind==='system'?['layouts']:[...node.path,key],array=valueAt(pkg,path),kind=kinds[key];
    if(!Array.isArray(array)){const owner=valueAt(pkg,path.slice(0,-1));if(owner!=null && Object.hasOwn(Object(owner),path.at(-1)))throw new Error('Ramo estrutural existente incompatível. Corrija pelo JSON antes de adicionar; seu valor foi preservado.');return {commands:[{type:'setProperty',path,value:[blankNode(kind,pkg,type)]}],selection:[...path,0]};}
    const value=blankNode(kind,pkg,type);if(value.id)value.id=uniqueName(value.id,array.map(item=>item?.id));
    return {commands:[{type:'insertNode',path,index:array.length,value}],selection:[...path,array.length]};
  }
  if(['package','system'].includes(node.kind))throw new Error('O sistema não pode ser movido, duplicado ou removido.');
  const path=node.path.slice(0,-1),index=node.path.at(-1),array=valueAt(pkg,path);
  if(action==='remove')return {commands:[{type:'removeNode',path,index}],selection:node.path.slice(0,-2)};
  if(action==='duplicate'){
    const value=structuredClone(node.value);if(value?.id)value.id=uniqueName(value.id+'-copia',array.map(item=>item?.id));
    return {commands:[{type:'insertNode',path,index:index+1,value}],selection:[...path,index+1]};
  }
  if(action==='move'){
    if(!destinations(pkg,node.kind).some(item=>pointerFor(item.path)===pointerFor(destination)))throw new Error('Destino incompatível com o tipo de nó.');
    const dest=valueAt(pkg,destination);if(!Array.isArray(dest))throw new Error('Destino ausente.');
    if(node.value?.id && dest!==array && dest.some(item=>item?.id===node.value.id))throw new Error('ID já existe no destino. Renomeie explicitamente antes de mover.');
    return {commands:[{type:'moveNode',path,index,toPath:destination,to}],selection:[...destination,to]};
  }
  throw new Error('Operação estrutural desconhecida.');
}
// Selection is a sidecar: no IDs are injected into the package. Arbitrary JSON is
// reconciled only by a unique unchanged value, or a unique existing identity.
export function reconcileSelection(previous,next,selection) {
  if(!selection)return null;
  const old=structuralNodes(previous).find(node=>node.pointer===pointerFor(selection));if(!old)return null;
  const candidates=structuralNodes(next).filter(node=>node.kind===old.kind);
  const same=candidates.filter(node=>JSON.stringify(node.value)===JSON.stringify(old.value));if(same.length===1)return same[0].path;
  if(object(old.value) && old.value.id){const match=candidates.filter(node=>node.value?.id===old.value.id);if(match.length===1)return match[0].path;}
  if(old.kind==='system' && object(next.system))return ['system'];return null;
}

// Visual repair can inspect parseable incompatible branches without using lastValid.
export function editableVisualDocument(session){const result=session.validate();if(!object(result.value)||result.status==='unsupported'||result.diagnostics.some(issue=>issue.code?.startsWith('json.')))throw new Error('O texto não pode ser interpretado sem perda. Preserve o rascunho e corrija a sintaxe ou a versão no acesso avançado.');return revisionProjection(result.value);}
