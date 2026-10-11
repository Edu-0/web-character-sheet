import {dataDefinition,dataDefinitions,dataPath,readData} from './data-definitions.js';
import {pathKeys} from './paths.js';
export const COMPOSITION_LIMITS=Object.freeze({depth:8,expanded:10000,definitions:100});

// Check entry scopes even when a collection currently has no occurrences.
export function compositionBindingIssues(container,system,path='container'){
  const issues=[],rows=dataDefinitions(system);let steps=0;
  const visit=(owner,at,scopes=[],parameters={},seen=[],depth=0)=>{
    if(++steps>COMPOSITION_LIMITS.expanded||depth>COMPOSITION_LIMITS.depth){issues.push({path:at,message:'Limite de composição excedido'});return;}
    const check=(id,slot)=>{const row=rows.find(r=>r.definition.id===id);if(!row)return;for(const ancestor of row.ancestors)if(ancestor.type==='collection'&&!scopes.includes(ancestor.id))issues.push({path:slot,message:row.definition.label+': exige contexto de entrada de '+ancestor.label});};
    if(owner.repeat?.scope==='character'){
      if(scopes.includes(owner.repeat.dataId))issues.push({path:at+'.repeat.dataId',message:'A mesma coleção não pode ser repetida duas vezes na cadeia de contexto'});
      check(owner.repeat.dataId,at+'.repeat.dataId');scopes=[...scopes,owner.repeat.dataId];
    }
    for(const [i,c]of (owner.components||[]).entries()){
      const slot=at+'.components['+i+']';if(c.dataId!==undefined||c.dataParameter!==undefined)check(c.dataId??parameters[c.dataParameter],slot+'.dataId');
      if(c.ruleId){const rule=system.rules?.find(r=>r.id===c.ruleId);if(rule?.context){check(rule.context.dataId,slot+'.ruleId');if(!scopes.includes(rule.context.dataId))issues.push({path:slot+'.ruleId',message:rule.label+': exige contexto de entrada do cálculo'});}}
      if(c.type==='group')visit(c,slot,scopes,parameters,seen,depth+1);
      if(c.type==='componentInstance'){
        const definition=system.componentDefinitions?.find(d=>d.id===c.definitionId);if(!definition||seen.includes(definition.id))continue;
        visit({...definition,...(c.repeat?{repeat:c.repeat}:{})},slot,scopes,{...parameters,...c.bindings},[...seen,definition.id],depth+1);
      }
    }
  };visit(container,path);return issues;
}

// One bounded projection shared by rendering, search, print and validation.
// Occurrence IDs stay separate from canonical definition paths and entry indices.
export function expandComposition(container,system,character={},options={}) {
  const output=[];let steps=0;
  const visit=(owner,path,context={},parents=[],definitions=[],depth=0,parameters={},canonicalSource=null,wrapper=null)=>{
    if(depth>COMPOSITION_LIMITS.depth)throw new Error('Composição excede oito níveis');
    if(++steps>COMPOSITION_LIMITS.expanded)throw new Error('Orçamento de composição excedido');
    let occurrences=[{context,owner}];
    if(owner.repeat?.scope==='character'){
      if(context.entries?.some(e=>e.dataId===owner.repeat.dataId))throw new Error('A mesma coleção não pode ser repetida duas vezes na cadeia de contexto');
      const definition=dataDefinition(system,owner.repeat.dataId);if(definition.type!=='collection')throw new Error('Repeat exige coleção do personagem');
      const cell=readData(system,character,definition.id,context);
      occurrences=(!cell.present||cell.value===null?[]:cell.value).map(entry=>({owner,context:{entries:[...(context.entries||[]),{dataId:definition.id,entryId:entry.id}]}}));
    } else if(owner.repeat) {
      // Legacy catalog repeat retains its interpolation and ordering semantics.
      occurrences=options.legacyItems(owner.repeat.source).map((item,index)=>({owner,context:{...context,interpolation:item&&typeof item==='object'?{index,...item}:{index,key:item,name:item,label:item,value:item}}}));
    }
    const emptyPreview=()=>{
      if(output.length>=COMPOSITION_LIMITS.expanded)throw new Error('Expansão excede orçamento');
      output.push(JSON.parse(JSON.stringify({type:'information',label:wrapper.label,text:wrapper.note||'Grupo sem entradas. Inclua componentes aqui para definir sua apresentação.',sourcePath:[...(canonicalSource||path)],groupTrail:parents,occurrenceIds:(context.entries||[]).map(e=>e.entryId)})));
    };
    if(!occurrences.length&&wrapper&&options.includeEmptyGroups)emptyPreview();
    for(const occurrence of occurrences){
    const groups=wrapper?[...parents,{...wrapper,occurrence:occurrence.context.entries||[]}]:parents;
    for(const [index,original]of (owner.components||[]).entries()){
      const source=[...path,'components',index],component=options.interpolate(original,occurrence.context.interpolation||{});
      if(component.type==='group') {
        const group={label:component.label,note:component.note,help:component.help,variant:component.variant,print:component.print,layout:component.layout||{type:'stack'},path:canonicalSource||source};
        visit(component,source,occurrence.context,groups,definitions,depth+1,parameters,canonicalSource,group);continue;
      }
      if(component.type==='componentInstance'){
        if(definitions.includes(component.definitionId))throw new Error('Ciclo de composição local');
        const definition=system?.componentDefinitions?.find(d=>d.id===component.definitionId);if(!definition)throw new Error('Composto local inexistente');
        const bindings={...parameters,...component.bindings};
        visit({...definition,...(component.repeat?{repeat:component.repeat}:{})},source,occurrence.context,groups,[...definitions,definition.id],depth+1,bindings,canonicalSource||source,{label:component.label||definition.label,note:component.note,help:component.help,variant:component.variant,print:component.print,layout:definition.layout||{type:'stack'},path:canonicalSource||source});continue;
      }
      if(component.dataParameter!==undefined){component.dataId=parameters[component.dataParameter];delete component.dataParameter;if(!component.dataId)throw new Error('Parâmetro de composto sem vínculo');}
      if(component.dataId!==undefined){dataDefinition(system,component.dataId);component.field=dataPath(system,character,component.dataId,occurrence.context);component.boundData=true;component.dataContext=occurrence.context;}
      if(component.ruleId!==undefined)component.dataContext=occurrence.context;
      if(component.field)pathKeys(component.field);
      if(output.length>=COMPOSITION_LIMITS.expanded)throw new Error('Expansão de componentes excede10000 entradas');
      output.push({...component,sourcePath:[...(canonicalSource||source)],groupTrail:JSON.parse(JSON.stringify(groups)),occurrenceIds:(occurrence.context.entries||[]).map(e=>e.entryId)});
    }
    if(!(owner.components||[]).length&&wrapper&&(wrapper.label||wrapper.note||options.includeEmptyGroups)){
      if(output.length>=COMPOSITION_LIMITS.expanded)throw new Error('Expansão excede orçamento');
      output.push(JSON.parse(JSON.stringify({type:'information',label:wrapper.label,text:wrapper.note||(options.includeEmptyGroups?'Grupo vazio. Inclua componentes aqui.':''),help:wrapper.help,variant:wrapper.variant,print:wrapper.print,sourcePath:[...(canonicalSource||path)],groupTrail:parents,occurrenceIds:(occurrence.context.entries||[]).map(e=>e.entryId)})));
    }
    }
  };
  visit(container,options.sourcePath||[],options.context||{});return output;
}
