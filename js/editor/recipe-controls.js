import {el,input,choose,button} from './authoring-dom.js';
import {numberFromText} from './form-commands.js';

// All text remains in the session UI sidecar until the recipe is committed.
export function recipeControls(host,state,notify){
 const text=(label,key,initial='',parent=host)=>{const c=input(label,state[key]??initial);parent.append(c.wrap);c.input.addEventListener('input',()=>{state[key]=c.input.value;notify?.();});return ()=>c.input.value;};
 const number=(label,key,initial='',options={},parent=host)=>{const read=text(label,key,initial,parent);return ()=>numberFromText(read(),options);};
 const select=(label,key,options,initial='',parent=host)=>{const dynamic=typeof options==='function',c=choose(label,dynamic?options():options,state[key]??initial);parent.append(c.wrap);const refresh=()=>{const value=state[key]??initial,entries=options();if(value&&!entries.some(([id])=>id===value))entries.push([value,'Escolha existente ou pendente: '+value]);c.input.replaceChildren(...entries.map(([id,text])=>{const option=el('option',text);option.value=id;return option;}));c.input.value=value;};if(dynamic){c.input.addEventListener('focus',refresh);host.addEventListener('input',refresh);host.addEventListener('change',refresh);}c.input.addEventListener('change',()=>{state[key]=c.input.value;notify?.();});return ()=>c.input.value;};
 const yes=(label,key,parent=host)=>{const read=select(label,key,[['no','Não'],['yes','Sim']],'no',parent);return ()=>read()==='yes';};
 const rows=(title,key,initial,draw,parent=host)=>{
  state[key]??=structuredClone(initial);const wrap=el('fieldset'),list=el('div');wrap.append(el('legend',title),list);parent.append(wrap);let readers=[];
  const render=()=>{list.replaceChildren();readers=state[key].map((row,i)=>{const box=el('fieldset');box.append(el('legend',title+' '+(i+1)));list.append(box);const controls=recipeControls(box,row,notify),read=draw(controls,row,i,box);box.append(button('Remover '+title+' '+(i+1),()=>{state[key].splice(i,1);render();notify?.();}));return read;});};
  wrap.append(button('Acrescentar '+title,()=>{if(state[key].length>=100)return;state[key].push(structuredClone(initial[0]||{}));render();notify?.();}));render();return ()=>readers.map(read=>read());
 };
 return {text,number,select,yes,rows};
}
export function costTableControls(host,{scale,state={},notify,steps=false,label='Custo',integer=false}){
 const c=recipeControls(host,state,notify),keys=steps?scale.map((to,i)=>[i?scale[i-1]:0,to]):scale.map(to=>[to]);
 const readers=keys.map(parts=>[parts.join('->'),c.number(label+' '+parts.map(v=>v?'d'+v:'sem dado').join(' → '),parts.join('->'),'',{integer})]);
 return ()=>Object.fromEntries(readers.map(([key,read])=>{const value=read();if(value<0)throw new Error('Custos precisam ser não negativos.');return [key,value];}));
}
