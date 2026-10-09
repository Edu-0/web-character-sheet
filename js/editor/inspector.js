import {valueAt,object,safeKey} from './form-structure.js';
import {pointerFor} from './source-map.js';
import {labelFor,propertyGroup,initialValue,resolveSchema} from './form-metadata.js';
import {setValueCommands,renameKeyCommands,numberFromText} from './form-commands.js';
const el=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const button=(label,fn)=>{const node=el('button',label,'button button--ghost');node.type='button';node.addEventListener('click',fn);return node;};
const choose=(label,options,value)=>{const input=el('select');input.setAttribute('aria-label',label);for(const [id,text]of options){const opt=el('option',text);opt.value=id;input.append(opt);}input.value=value;return input;};
const valueType=value=>value===null?'null':Array.isArray(value)?'array':typeof value==='object'?'object':typeof value;
export class Inspector {
  constructor(host,{session,commit,onPending,onJson,referenceOptions=()=>[],rename,remove}={}) {Object.assign(this,{host,session,onPending,onJson,referenceOptions,rename,remove});this.commit=(...args)=>Promise.resolve().then(()=>commit(...args)).catch(error=>{this.onPending?.(false,error.message);return false;});}
  pending(path,value) {const key=pointerFor(path);this.session.ui.formPending??={};if(value===undefined)delete this.session.ui.formPending[key];else this.session.ui.formPending[key]=value;this.onPending?.();}
  render(pkg,node,schema) {
    this.pkg=pkg;this.host.replaceChildren(el('h3','Propriedades: '+node.title));
    for(const group of ['Apresentação','Dados','Lógica']){const section=el('details','','editor-property-group');section.open=true;section.append(el('summary',group));for(const [key,desc]of Object.entries(schema))if(propertyGroup(key)===group)this.field(section,[...node.path,key],desc,key,0);if(section.children.length>1)this.host.append(section);}
    const known=new Set([...Object.keys(schema),'type','tabs','sections','containers','components','system']);
    this.advanced(this.host,node.path,node.value,known);this.host.append(button('Abrir este bloco no JSON',()=>this.onJson(node.path)));
  }
  advanced(parent,path,value,known) {const extra=object(value)?Object.keys(value).filter(key=>!known.has(key)):[];if(extra.length)parent.append(el('p','Avançado via JSON: '+extra.join(', ')+'. Propriedades preservadas.','editor-note'),button('Abrir propriedades avançadas no JSON',()=>this.onJson(path)));}
  field(parent,path,rawDesc,key,depth,ownerDesc={}) {
    const value=valueAt(this.pkg,path),owner=valueAt(this.pkg,path.slice(0,-1)),exists=owner!=null && Object.hasOwn(owner,path.at(-1)),pointer=pointerFor(path),label=rawDesc.label || labelFor(key);
    const desc=resolveSchema(rawDesc,value),stored=this.session.ui.formPending?.[pointer],row=el('div','','editor-property');row.dataset.property=pointer;row.append(el('strong',label));
    if(depth>16){row.append(el('p','Profundidade avançada: edite este ramo no JSON.'),button('Editar ramo em JSON',()=>this.onJson(path)));parent.append(row);return;}
    if(desc.semantic)row.append(el('small',desc.semantic.replace('; validação em schemas.js','').replace('; referências em roll-references.js',''),'editor-note'));
    const choices=[['absent','Ausente'],['value','Valor explícito'],...(desc.type==='any'||desc.nullable?[['null','null explícito']]:[]),...(Object.hasOwn(desc,'default')?[['default','Usar padrão: '+String(desc.default)]]:[])];
    if(value===null && !choices.some(([id])=>id==='null'))choices.push(['null','null existente (incompatível; corrigir ou usar JSON)']);
    const presence=choose('Estado de '+label,choices,stored?.mode ?? (!exists?'absent':value===null?'null':'value'));row.append(presence);
    const typed=desc.type==='any',typeInput=typed?choose('Tipo de valor de '+label,['string','number','boolean','object','array','null'].map(type=>[type,type]),stored?.valueType || (exists?valueType(value):'string')):null;
    let type=typed?typeInput.value:desc.type;
    if(typed)row.append(typeInput);
    const input=el(desc.enum||type==='boolean'?'select':desc.multiline?'textarea':'input');input.setAttribute('aria-label',label);
    if(desc.enum || type==='boolean')for(const entry of desc.enum || ['false','true']){const opt=el('option',String(entry));opt.value=String(entry);input.append(opt);}
    if(type==='boolean' && stored && !['false','true'].includes(stored.raw)){const opt=el('option',stored.raw+' (pendente)');opt.value=stored.raw;input.append(opt);}
    if(desc.enum && exists && !desc.enum.includes(value)){const opt=el('option',String(value)+' (existente)');opt.value=String(value);input.append(opt);}
    if(input.tagName==='INPUT'){input.type='text';if(['number','integer'].includes(type))input.inputMode='decimal';}
    input.value=stored?.raw ?? (exists && value!==null && !object(value)&&!Array.isArray(value)?String(value):type==='boolean'?'false':'');
    const complex=()=>['object','array'].includes(type);
    input.hidden=complex() || type==='null';row.append(input);
    if(desc.type==='path'){const options=this.referenceOptions(path,key);if(options.length){const list=el('datalist');list.id='refs-'+crypto.randomUUID();for(const option of options){const item=el('option');item.value=option;list.append(item);}input.setAttribute('list',list.id);row.append(list);}}
    const mark=()=>{this.pending(path,{mode:presence.value,raw:input.value,...(typed?{valueType:type}:{})});row.dataset.pending='true';};
    presence.addEventListener('change',mark);input.addEventListener('input',()=>{presence.value='value';mark();});input.addEventListener('change',()=>{presence.value='value';mark();});
    typeInput?.addEventListener('change',()=>{type=typeInput.value;input.hidden=complex() || type==='null';presence.value=type==='null'?'null':'value';mark();this.onPending?.(true);});
    const feedback=el('p');feedback.setAttribute('role','status');
    row.append(button('Aplicar campo',async()=>{try{
      const mode=presence.value;
      let next=mode==='default'?initialValue(desc):type==='null'||mode==='null'?null:complex()?(valueType(value)===type?value:initialValue({type})):input.value;
      if(mode==='value' && ['number','integer'].includes(type))next=numberFromText(input.value,{integer:type==='integer'});
      if(mode==='value' && type==='boolean'){if(!['true','false'].includes(input.value))throw new Error('Use true ou false.');next=input.value==='true';}
      if(mode==='absent' && this.remove){this.remove(path).catch(error=>feedback.textContent=error.message);return;}
      const commands=setValueCommands(this.pkg,path,next,mode==='absent');
      if(mode==='value' && ownerDesc.exclusive?.includes(key))for(const other of ownerDesc.exclusive)if(other!==key && Object.hasOwn(owner,other))commands.push(...setValueCommands(this.pkg,[...path.slice(0,-1),other],null,true));
      const committed=await this.commit(commands,'Editar '+label,path);if(committed===false)return;this.pending(path);this.onPending?.(true);
    }catch(error){feedback.textContent=error.message;input.setAttribute('aria-invalid','true');}}));
    row.append(button('Descartar texto deste campo',()=>{this.pending(path);this.onPending?.(true);}),feedback);
    if(desc.shorthand)row.append(button('Expandir definição abreviada',()=>{this.commit(setValueCommands(this.pkg,path,{type:value}),'Expandir campo de item');this.onPending?.(true);}));
    if(value!==null && (object(value)||Array.isArray(value))){
      const nested=typed?{type:valueType(value),...(object(value)?{values:{type:'any'}}:{items:{type:'any'}})}:desc;
      if(nested.properties || nested.values || nested.items){const details=el('details','','editor-nested');details.dataset.nested=pointer;details.append(el('summary','Configurar '+label));const content=el('div');details.append(content);let rendered=false;
        const populate=()=>{if(!details.open || rendered)return;rendered=true;this.children(content,path,value,nested,depth+1);};
        details.addEventListener('toggle',()=>{this.session.ui.formOpen??={};if(details.open)this.session.ui.formOpen[pointer]=true;else delete this.session.ui.formOpen[pointer];populate();this.onPending?.();});
        details.open=this.session.ui.formOpen?.[pointer]===true;populate();row.append(details);
      }else row.append(el('p','Esta configuração avançada exige JSON.','editor-note'),button('Editar em JSON',()=>this.onJson(path)));
    }
    if(path.at(-2)==='formulas')row.append(el('p','Expressão limitada da engine. Valide e atualize o ensaio para conferir o resultado.','editor-note'));
    parent.append(row);
  }
  children(parent,path,value,desc,depth) {
    if(Array.isArray(value)){
      value.forEach((item,index)=>{const wrap=el('div','','editor-array-entry');wrap.dataset.entry=pointerFor([...path,index]);this.field(wrap,[...path,index],desc.items || {type:'any'},'Entrada '+(index+1),depth,desc);
        wrap.append(button('Remover entrada '+(index+1),()=>this.removeValue([...path,index])),button('Subir entrada '+(index+1),()=>{if(index)this.commit([{type:'moveNode',path,index,to:index-1}],'Mover entrada');}),button('Descer entrada '+(index+1),()=>{if(index<value.length-1)this.commit([{type:'moveNode',path,index,to:index+1}],'Mover entrada');}),button('Duplicar entrada '+(index+1),()=>{const copy=structuredClone(item);if(object(copy)&&copy.id)copy.id=copy.id+'-copia-'+crypto.randomUUID().slice(0,4);this.commit([{type:'insertNode',path,index:index+1,value:copy}],'Duplicar entrada');}));parent.append(wrap);});
      parent.append(button('Adicionar entrada',()=>this.commit([{type:'insertNode',path,index:value.length,value:initialValue(desc.items || {type:'any'})}],'Adicionar entrada')));return;
    }
    const schema=desc.properties || Object.fromEntries(Object.keys(value).map(key=>[key,desc.values || {type:'any'}]));
    for(const [key,child]of Object.entries(schema))this.field(parent,[...path,key],child,key,depth,desc);
    this.advanced(parent,path,value,new Set(Object.keys(schema)));
    if(desc.values){const input=el('input');input.type='text';input.setAttribute('aria-label','Nova chave em '+pointerFor(path));const inputKey=pointerFor(path)+'::new-key';input.value=this.session.ui.formInputs?.[inputKey] ?? '';input.addEventListener('input',()=>{this.session.ui.formInputs??={};this.session.ui.formInputs[inputKey]=input.value;this.onPending?.();});parent.append(input,button('Adicionar propriedade',()=>{try{const key=safeKey(input.value);if(Object.hasOwn(value,key))throw new Error('Chave já existe.');this.commit(setValueCommands(this.pkg,[...path,key],initialValue(desc.values)),'Adicionar propriedade');}catch(error){input.setCustomValidity(error.message);input.reportValidity();}}));
      for(const key of Object.keys(value)){const row=el('div','','editor-key-actions'),rename=el('input');const renameKey=pointerFor([...path,key])+'::rename-key';rename.value=this.session.ui.formInputs?.[renameKey] ?? key;rename.addEventListener('input',()=>{this.session.ui.formInputs??={};this.session.ui.formInputs[renameKey]=rename.value;this.onPending?.();});rename.setAttribute('aria-label','Nova chave de '+key);const doRename=()=>{try{const result=this.rename?.([...path,key],rename.value) ?? this.commit(renameKeyCommands(this.pkg,[...path,key],rename.value),'Renomear propriedade');if(result?.catch)result.catch(error=>{rename.setCustomValidity(error.message);rename.reportValidity();});}catch(error){rename.setCustomValidity(error.message);rename.reportValidity();}};row.append(el('span','Chave: '+key),rename,button('Renomear '+key,doRename),button('Remover '+key,()=>this.removeValue([...path,key])));parent.append(row);}
    }
  }
  removeValue(path){if(this.remove)this.remove(path).catch(error=>this.onPending?.(false,error.message));else this.commit(setValueCommands(this.pkg,path,null,true),'Remover propriedade');}
}
