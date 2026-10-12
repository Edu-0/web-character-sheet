import {dataDefinition, readData} from './data-definitions.js';
import {writeValidatedData as writeData} from './typed-data-write.js';
import {mountEffectiveData} from './effective-data-field.js';

// The canonical value stays in the character at the definition's explicit binding.
export function renderBoundField(container, context) {
  const {system,character,dataId,label,registerRefresh,onChange,type}=context;
  const definition=dataDefinition(system,dataId),wrap=document.createElement('div');wrap.className='field';
  const title=document.createElement('label');title.textContent=label;
  const input=document.createElement(type==='textarea'?'textarea':'input');
  if(type!=='textarea')input.type=type==='number'?'number':type==='boolean'?'checkbox':'text';
  if(type==='number')input.step=definition.type==='integer'?'1':'any';
  if(type==='text' && context.placeholder)input.placeholder=context.placeholder;
  if(type==='textarea')input.rows=context.rows||3;
  input.setAttribute('aria-label',label);title.append(input);wrap.append(title);
  const presence=document.createElement('select');presence.setAttribute('aria-label','Presença de '+label);
  for(const [value,text]of [['value','Preenchido'],...(!definition.required?[['absent','Ausente']]:[]),...(definition.nullable?[['null','Nulo']]:[])]) {const option=document.createElement('option');option.value=value;option.textContent=text;presence.append(option);}
  if(!definition.required || definition.nullable)wrap.append(presence);
  const status=document.createElement('span');status.setAttribute('role','status');wrap.append(status);
  const refresh=()=>{
    const cell=readData(system,character,dataId,context.dataContext);presence.value=!cell.present?'absent':cell.value===null?'null':'value';
    if(document.activeElement!==input){if(type==='boolean')input.checked=cell.value===true;else input.value=cell.value??'';input.setCustomValidity('');status.textContent='';}
    input.disabled=cell.present && cell.value===null;
  };
  const write=()=>{
    let value=type==='boolean'?input.checked:type==='number'?(input.value===''?undefined:Number(input.value)):input.value;
    try {
      if(type==='number' && value===undefined)writeData(system,character,dataId,{present:false},context.dataContext);
      else writeData(system,character,dataId,{present:true,value},context.dataContext);
      input.setCustomValidity('');status.textContent='';presence.value=type==='number'&&value===undefined?'absent':'value';onChange?.();
    }catch(error){input.setCustomValidity(error.message);status.textContent=error.message;}
  };
  input.addEventListener(type==='boolean'?'change':'input',write);
  presence.addEventListener('change',()=>{
    const mode=presence.value;
    try {
      const previous=readData(system,character,dataId,context.dataContext);
      writeData(system,character,dataId,mode==='absent'?{present:false}:{present:true,value:mode==='null'?null:previous.present&&previous.value!==null?previous.value:definition.type==='boolean'?false:definition.type==='string'?'':0},context.dataContext);
      refresh();onChange?.();
    }catch(error){status.textContent=error.message;}
  });
  refresh();registerRefresh?.(refresh);mountEffectiveData(wrap,context);container.append(wrap);
}
