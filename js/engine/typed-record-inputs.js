import {referenceEntries,entryLabel} from './data-references.js';
const node=(tag,text='')=>{const element=document.createElement(tag);element.textContent=text;return element;};
const own=(value,key)=>value!=null&&Object.hasOwn(value,key);

// An uncommitted creation/edit form. Its draft never replaces the character.
export function mountRecordInputs(host,{definition,system,character,label,state={},base={},context={},onEdit=()=>{}}){
  const readers=[];
  for(const field of definition.fields||[]){
    const initial=own(base,field.binding)?base[field.binding]:field.initial;
    const previous=state[field.id],draft=previous&&typeof previous==='object'?previous:(state[field.id]=typeof previous==='string'?{mode:previous===''||previous==='absent'?'absent':'value',raw:previous}:{});
    draft.mode??=initial===null?'null':initial!==undefined||field.required?'value':'absent';
    const wrap=node('fieldset');wrap.className='engine-typed-input';wrap.append(node('legend',field.label));host.append(wrap);
    const presence=node('select');presence.setAttribute('aria-label','Presença de '+label+' · '+field.label);
    for(const [value,text]of [['value','Preenchido'],...(!field.required?[['absent','Ausente']]:[]),...(field.nullable?[['null','Nulo']]:[])]){const option=node('option',text);option.value=value;presence.append(option);}presence.value=draft.mode;
    if(!field.required||field.nullable)wrap.append(presence);
    const body=node('div');wrap.append(body);let read;
    const edited=()=>{draft.mode='value';presence.value='value';onEdit();};
    const draw=()=>{
      body.replaceChildren();read=()=>undefined;if(draft.mode==='null')return;
      if(field.type==='record'){draft.fields??={};read=mountRecordInputs(body,{definition:field,system,character,label:label+' · '+field.label,state:draft.fields,base:initial&&typeof initial==='object'?initial:{},context,onEdit:edited});return;}
      if(field.type==='collection'){
        draft.entries??=structuredClone(Array.isArray(initial)?initial:[]).map(value=>({value,state:{}}));
        const items=node('div');body.append(items);let entries=[];
        const drawEntries=()=>{items.replaceChildren();entries=draft.entries.map((entry,index)=>{const row=node('fieldset');row.append(node('legend','Entrada '+(index+1)));items.append(row);const readEntry=mountRecordInputs(row,{definition:field,system,character,label:label+' · '+field.label+' · '+(index+1),state:entry.state,base:entry.value,context,onEdit:edited});const remove=node('button','Remover nova entrada '+(index+1));remove.type='button';remove.addEventListener('click',()=>{draft.entries.splice(index,1);drawEntries();edited();});row.append(remove);return ()=>({...readEntry(),id:entry.value.id});});};drawEntries();const add=node('button','Acrescentar entrada em '+label+' · '+field.label);add.type='button';add.addEventListener('click',()=>{draft.entries.push({value:{id:'entry-'+crypto.randomUUID()},state:{}});drawEntries();edited();});body.append(add);read=()=>entries.map(read=>read());return;
      }
      const selection=['enum','trait','reference','boolean'].includes(field.type),control=node(selection?'select':'input');control.setAttribute('aria-label',label+' · '+field.label);
      if(selection){
        const options=field.type==='boolean'?[{id:'false',label:'Não'},{id:'true',label:'Sim'}]:field.type==='enum'?field.options:field.type==='trait'?field.scale.map(value=>({id:String(value),label:'d'+value})):referenceEntries(system,character,field,context).map(entry=>({id:entry.id,label:entryLabel(entry,system.catalogs?.find(c=>c.id===field.target?.catalogId)?.fields)}));
        if(field.multiple)control.multiple=true;
        if(!field.multiple&&field.type!=='boolean'&&field.type!=='trait'){const option=node('option','Escolha');option.value='';control.append(option);}
        for(const option of options){const el=node('option',option.label);el.value=String(option.id);control.append(el);}
      }else control.type=['number','integer'].includes(field.type)?'number':'text';
      draft.raw??=field.type==='trait'?String(initial?.[0]??field.scale[0]):field.multiple?structuredClone(initial??[]):String(initial??(field.type==='boolean'?false:''));
      if(control.multiple){for(const option of control.options)option.selected=draft.raw.includes(option.value);}else control.value=draft.raw;
      const save=()=>{draft.raw=control.multiple?[...control.selectedOptions].map(o=>o.value):control.value;edited();};control.addEventListener('input',save);control.addEventListener('change',save);body.append(control);
      if(field.type==='trait'&&field.composite){draft.dice??=structuredClone(Array.isArray(initial)?initial:[field.scale[0]]);const summary=node('p',draft.dice.map(n=>'d'+n).join(' + ')),add=node('button','Acrescentar dado em '+label+' · '+field.label),remove=node('button','Retirar dado em '+label+' · '+field.label);for(const b of [add,remove])b.type='button';add.addEventListener('click',()=>{draft.dice.push(Number(control.value));summary.textContent=draft.dice.map(n=>'d'+n).join(' + ');edited();});remove.addEventListener('click',()=>{draft.dice.pop();summary.textContent=draft.dice.map(n=>'d'+n).join(' + ');edited();});body.append(summary,add,remove);read=()=>structuredClone(draft.dice);}
      else read=()=>field.type==='boolean'?control.value==='true':['number','integer'].includes(field.type)?(control.value===''?undefined:Number(control.value)):field.type==='trait'?[Number(control.value)]:field.multiple?[...control.selectedOptions].map(o=>o.value):control.value;
    };presence.addEventListener('change',()=>{draft.mode=presence.value;draw();onEdit();});draw();
    readers.push(()=>({field,mode:draft.mode,value:read()}));
  }
  return ()=>{const result=structuredClone(base);for(const reader of readers){const {field,mode,value}=reader();if(mode==='absent')delete result[field.binding];else if(mode==='null')result[field.binding]=null;else if(value===undefined)delete result[field.binding];else result[field.binding]=value;}return result;};
}
