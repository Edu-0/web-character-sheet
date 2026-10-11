import {registerFieldType} from './fields.js';
import {dataDefinition,readData} from './data-definitions.js';
import {writeValidatedData} from './typed-data-write.js';
import {initialRecord,typedValueIssue} from './data-types.js';
import {referenceEntries,referenceValueIssue,entryLabel} from './data-references.js';
import {typedSearchRecords} from './typed-value-format.js';
import {mountRecordInputs} from './typed-record-inputs.js';
const node=(tag,text='')=>{const element=document.createElement(tag);element.textContent=text;return element;};

registerFieldType('information',{
  render(host,{label,text}){const section=node('section');if(label)section.append(node('h3',label));if(text)section.append(node('p',text));host.append(section);},
  search:({label,text})=>[{label,value:text||'—'}],
});
// Containers and instances are expanded by the shared composition walk.
registerFieldType('group',{render(){}});
registerFieldType('componentInstance',{render(){}});
registerFieldType('dataField',{
  render(host,context){
    host.classList.add('engine-structured-field');
    const {system,character,registerRefresh,onChange}=context,definition=dataDefinition(system,context.dataId);
    const status=node('p');status.setAttribute('role','status');const body=node('div');host.append(body,status);
    let previous;const entryDrafts=new Map();
    const change=(definition,cell,dataContext)=>{
      try{if(cell.present&&definition.type==='reference'){const issue=referenceValueIssue(system,character,definition,cell.value,dataContext);if(issue)throw new Error(issue);}
        writeValidatedData(system,character,definition.id,cell,dataContext);status.textContent='';onChange?.();refresh();
      }catch(error){status.textContent=error.message;}
    };
    const button=(label,action)=>{const b=node('button',label);b.type='button';b.className='button button--ghost';b.addEventListener('click',()=>{try{action();}catch(error){status.textContent=error.message;}});return b;};
    const render=(parent,d,label,dataContext={})=>{
      const cell=readData(system,character,d.id,dataContext),section=node('fieldset');section.dataset.dataId=d.id;section.append(node('legend',label));parent.append(section);
      const presence=node('select');presence.setAttribute('aria-label','Presença de '+label);
      for(const [value,text]of [['value','Preenchido'],...(!d.required?[['absent','Ausente']]:[]),...(d.nullable?[['null','Nulo']]:[])]){const option=node('option',text);option.value=value;presence.append(option);}
      presence.value=!cell.present?'absent':cell.value===null?'null':'value';
      if(!d.required||d.nullable)section.append(presence);
      const neutral=()=>d.type==='record'?initialRecord(d):['collection','reference','trait'].includes(d.type)?d.type==='trait'?[d.scale[0]]:d.type==='reference'&&!d.multiple?referenceEntries(system,character,d,dataContext)[0]?.id:[]:d.type==='enum'?d.options[0].id:d.type==='boolean'?false:d.type==='string'?'':0;
      presence.addEventListener('change',()=>change(d,presence.value==='absent'?{present:false}:{present:true,value:presence.value==='null'?null:cell.present&&cell.value!==null?cell.value:neutral()},dataContext));
      if(!cell.present||cell.value===null){
        section.append(node('p',cell.present?'null explícito':'Ausente'));
        if(['record','collection'].includes(d.type)){
          const draftKey=JSON.stringify(['create',d.id,dataContext.entries||[]]);if(!entryDrafts.has(draftKey))entryDrafts.set(draftKey,{});
          const kind=d.type==='record'?'registro':'coleção',creation=node('details');creation.append(node('summary','Preencher '+kind+' '+label));section.append(creation);
          const draftDefinition=d.type==='record'?d:{fields:[{...d,binding:'value',label:'Entradas',required:true}]};
          const read=mountRecordInputs(creation,{definition:draftDefinition,system,character,label:(d.type==='record'?'Novo registro':'Nova coleção')+' · '+label,state:entryDrafts.get(draftKey),context:dataContext});
          creation.append(button('Confirmar '+kind+' '+label,()=>change(d,{present:true,value:d.type==='record'?read():read().value},dataContext)));
        }
        return;
      }
      if(d.type==='record'){for(const field of d.fields||[])render(section,field,label+' · '+field.label,dataContext);return;}
      if(d.type==='collection'){
        for(const [index,entry]of cell.value.entries()){
          const item=node('details');item.dataset.collectionId=d.id;item.dataset.entryId=entry.id;item.open=true;const title=entryLabel(entry,d.fields);item.append(node('summary',title));section.append(item);
          const entryContext={entries:[...(dataContext.entries||[]),{dataId:d.id,entryId:entry.id}]};
          for(const field of d.fields||[])render(item,field,label+' · '+title+' · '+field.label,entryContext);
          item.append(button('Remover '+title,()=>change(d,{present:true,value:readData(system,character,d.id,dataContext).value.filter(e=>e.id!==entry.id)},dataContext)));
          for(const [delta,text]of [[-1,'Subir '],[1,'Descer ']]){const b=button(text+title,()=>{const entries=structuredClone(readData(system,character,d.id,dataContext).value),position=entries.findIndex(e=>e.id===entry.id),to=position+delta;if(to<0||to>=entries.length)return;[entries[position],entries[to]]=[entries[to],entries[position]];change(d,{present:true,value:entries},dataContext);});b.disabled=index+delta<0||index+delta>=cell.value.length;item.append(b);}
        }
        const draftKey=JSON.stringify([d.id,dataContext.entries||[]]);if(!entryDrafts.has(draftKey))entryDrafts.set(draftKey,{});
        const creation=node('details');creation.append(node('summary','Nova entrada em '+label));section.append(creation);
        const readEntry=mountRecordInputs(creation,{definition:d,system,character,label:'Nova entrada · '+label,state:entryDrafts.get(draftKey),context:dataContext});
        section.append(button('Adicionar entrada em '+label,()=>{
          const entry={...readEntry(),id:'entry-'+crypto.randomUUID()},issue=typedValueIssue({...d,type:'record'},entry);
          if(issue)throw new Error('Revise a nova entrada: '+issue);
          change(d,{present:true,value:[...readData(system,character,d.id,dataContext).value,entry]},dataContext);
        }));return;
      }
      const control=node(['enum','reference','trait'].includes(d.type)?'select':'input');control.setAttribute('aria-label',label);
      if(control.tagName==='SELECT'){
        const referenceFields=d.type==='reference'?(d.target.scope==='system'?system.catalogs?.find(c=>c.id===d.target.catalogId)?.fields:dataDefinition(system,d.target.dataId).fields):[];
        const options=d.type==='enum'?d.options:d.type==='trait'?d.scale.map(n=>({id:n,label:'d'+n})):referenceEntries(system,character,d,dataContext).map(e=>({id:e.id,label:entryLabel(e,referenceFields)}));
        if(d.type==='reference'&&d.multiple)control.multiple=true;
        for(const option of options){const el=node('option',option.label);el.value=String(option.id);el.selected=d.multiple?cell.value.includes(option.id):d.type==='trait'?cell.value[0]===option.id:cell.value===option.id;control.append(el);}
        if(d.type==='trait'&&d.composite){section.append(node('p','Dados: '+cell.value.map(n=>'d'+n).join(' + ')),button('Acrescentar dado em '+label,()=>change(d,{present:true,value:[...cell.value,Number(control.value)]},dataContext)));if(cell.value.length>1)section.append(button('Remover último dado de '+label,()=>change(d,{present:true,value:cell.value.slice(0,-1)},dataContext)));}
      }else {control.type=d.type==='boolean'?'checkbox':['number','integer'].includes(d.type)?'number':'text';if(control.type==='checkbox')control.checked=cell.value;else control.value=cell.value;if(control.type==='number')control.step=d.type==='integer'?'1':'any';}
      control.addEventListener(control.tagName==='SELECT'||d.type==='boolean'?'change':'input',()=>{
        const value=d.type==='boolean'?control.checked:['number','integer'].includes(d.type)?Number(control.value):d.type==='trait'?[Number(control.value),...cell.value.slice(1)]:d.type==='reference'&&d.multiple?[...control.selectedOptions].map(o=>o.value):control.value;
        if(['number','integer'].includes(d.type)&&control.value===''){change(d,{present:false},dataContext);return;}
        change(d,{present:true,value},dataContext);
      });section.append(control);
    };
    const refresh=()=>{
      try{const referenceState=dataDefinition(system,context.dataId).type==='reference'?referenceEntries(system,character,definition,context.dataContext):[];const current=JSON.stringify([readData(system,character,definition.id,context.dataContext),referenceState]);
        if(current===previous)return;previous=current;
        const active=body.contains(document.activeElement)?document.activeElement:null,label=active?.getAttribute('aria-label'),start=active?.selectionStart,end=active?.selectionEnd;
        body.replaceChildren();render(body,definition,context.label||definition.label,context.dataContext);
        if(label){const replacement=[...body.querySelectorAll('[aria-label]')].find(c=>c.getAttribute('aria-label')===label);replacement?.focus({preventScroll:true});if(replacement?.type==='text'&&start!=null)replacement.setSelectionRange(start,end);}
      }catch(error){status.textContent=error.message;}
    };refresh();registerRefresh?.(refresh);
  },
  search:typedSearchRecords,
  revealSearchResult(wrapper,entry){let target=wrapper;for(const occurrence of entry.entryIds||[]){const found=[...target.querySelectorAll('details[data-entry-id]')].find(node=>node.dataset.collectionId===occurrence.dataId&&node.dataset.entryId===occurrence.entryId);if(found){found.open=true;target=found;}}return [...target.querySelectorAll('fieldset[data-data-id]')].find(node=>node.dataset.dataId===entry.dataId)||target;},
});
