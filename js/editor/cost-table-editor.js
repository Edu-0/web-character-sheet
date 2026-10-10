import {costTableControls} from './recipe-controls.js';
import {el,button} from './authoring-dom.js';
export function mountCostTableEditor(host,{value,scale,steps,state={},onEdit,onApply}){
 state.values??={};const keys=scale.map((to,i)=>steps?(i?scale[i-1]:0)+'->'+to:String(to));
 for(const key of keys)if(!Object.hasOwn(state.values,key)&&Object.hasOwn(value,key))state.values[key]=String(value[key]);
 host.append(el('p','Escolha o custo de cada dado ou passagem. Zero é explícito. Valores adicionais da tabela são preservados.','editor-note'));
 const read=costTableControls(host,{scale,state:state.values,steps,notify:()=>{try{read();state.invalid=null;}catch(error){state.invalid=error.message;}onEdit?.(state);}}),status=el('p');status.setAttribute('role','status');host.append(status,button('Aplicar tabela de custos',async()=>{try{const next={...structuredClone(value),...read()};await onApply(next);status.textContent='Custos aplicados.';}catch(error){status.textContent=error.message;}}));
}
