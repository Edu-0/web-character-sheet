import {recipeControls} from './recipe-controls.js';
import {el,button} from './authoring-dom.js';
import {generatedKey} from './data-index.js';
import {structureCommand,structuralNodes,valueAt} from './form-structure.js';
import {setValueCommands} from './form-commands.js';
import {pointerFor} from './source-map.js';

export function layoutPlan(pkg,{action,index,name,mode,source}){
 const node=structuralNodes(pkg).find(n=>n.kind==='layout'&&n.path[1]===index),layout=node?.value;
 if(['rename','remove','up','down'].includes(action)&&!layout)throw new Error('Escolha um layout existente.');
 if(action==='rename'){if(!name?.trim())throw new Error('Informe o nome mostrado para o layout.');return {commands:[...setValueCommands(pkg,[...node.path,'name'],name),...(mode==='keep'?[]:setValueCommands(pkg,[...node.path,'mode'],mode,mode==='absent'))],selection:node.path,notes:['Nome/apresentação mudam; identidade, dados e regras permanecem.']};}
 if(action==='remove'){if(pkg.layouts.length<=1)throw new Error('Mantenha ao menos um layout no pacote.');const fallback=pkg.layouts.filter((_,i)=>i!==index)[0];return {...structureCommand(pkg,node,'remove'),notes:['Remover somente esta apresentação; dados, template e personagens não são apagados.','Se a preferência real apontar ao layout removido, o fluxo de aplicação usará '+(fallback.name||fallback.id)+', primeiro layout restante.']};}
 if(action==='up'||action==='down'){const to=index+(action==='up'?-1:1);if(to<0||to>=pkg.layouts.length)throw new Error('Este layout já está no limite da ordem.');return {...structureCommand(pkg,node,'move',{destination:['layouts'],to}),notes:['Ordem altera o fallback quando a preferência não está disponível.']};}
 if(!name?.trim())throw new Error('Informe o nome do novo layout.');let value;
 if(action==='copy'){if(!pkg.layouts[source])throw new Error('Escolha o layout de origem.');value=structuredClone(pkg.layouts[source]);}
 else if(action==='new')value=structureCommand(pkg,structuralNodes(pkg).find(n=>n.kind==='system'),'add').commands[0].value;
 else throw new Error('Operação de layout desconhecida.');
 value.id=generatedKey(name,pkg.layouts.map(l=>l.id));value.name=name;if(mode==='absent')delete value.mode;else if(mode!=='keep')value.mode=mode;
 if(pkg.system.effectDefinitions?.length){value.schemaVersion=2;const hasEffect=(value.tabs||[]).some(t=>(t.sections||[]).some(s=>(s.containers||[]).some(g=>g.components?.some(c=>c.type==='effectList'))));if(!hasEffect)value.tabs[0].sections[0].containers[0].components.push({type:'effectList',label:'Efeitos'});}
 const selection=['layouts',pkg.layouts.length];return {commands:[{type:'insertNode',path:['layouts'],index:pkg.layouts.length,value}],selection,notes:['Novo ID local sem colisão. Dados e regras do sistema permanecem compartilhados.','A seleção do ensaio não altera a preferência da biblioteca.'],id:value.id};
}
export function renderLayoutManager(view,pkg){
 const host=el('details','','editor-layout-manager');host.append(el('summary','Organizar layouts'));host.open=view.session.ui.layoutManagerOpen===true;host.addEventListener('toggle',()=>{view.session.ui.layoutManagerOpen=host.open;view.onPending?.();});
 view.session.ui.layoutInputs??={};const state=view.session.ui.layoutInputs,c=recipeControls(host,state,()=>view.onPending?.()),name=c.text('Nome do novo layout','name'),mode=c.select('Apresentação do novo layout','mode',[['absent','Completo'],['table','Modo mesa']],'absent'),source=c.select('Origem da cópia de layout','source',pkg.layouts.map((l,i)=>[String(i),l.name||l.id]),'0');
 const run=(options)=>view.run(async()=>{const revision=view.session.revision,plan=layoutPlan(pkg,options);if(!await view.confirm('Organizar layout? '+plan.notes.join(' ')))return;if(revision!==view.session.revision)throw new Error('A revisão mudou. Revise novamente.');view.commit(plan.commands,'Organizar layouts',plan.selection);});
 host.append(button('Criar layout nomeado',()=>run({action:'new',name:name(),mode:mode()})),button('Criar cópia nomeada do layout',()=>run({action:'copy',source:Number(source()),name:name(),mode:mode()})),el('p','Layout é uma apresentação dos mesmos dados. Copiar não duplica personagens. Modo mesa conserva busca e usa o layout completo para impressão quando disponível.','editor-note'));
 for(const [i,layout]of pkg.layouts.entries()){state[layout.id]??={};const row=el('fieldset');row.append(el('legend',layout.name||layout.id));const r=recipeControls(row,state[layout.id],()=>view.onPending?.()),title=r.text('Nome mostrado do layout '+(i+1),'name',layout.name||layout.id),presentation=r.select('Apresentação do layout '+(i+1),'mode',[['keep','Conservar configuração atual'],['absent','Completo'],['table','Modo mesa']],'keep');row.append(button('Aplicar nome e apresentação do layout '+(i+1),()=>run({action:'rename',index:i,name:title(),mode:presentation()})));const up=button('Subir layout '+(i+1),()=>run({action:'up',index:i})),down=button('Descer layout '+(i+1),()=>run({action:'down',index:i}));up.disabled=i===0;down.disabled=i===pkg.layouts.length-1;row.append(up,down,button('Excluir layout '+(i+1),()=>run({action:'remove',index:i})));host.append(row);}
 return host;
}
