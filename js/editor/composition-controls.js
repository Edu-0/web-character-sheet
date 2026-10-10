import {valueAt} from './form-structure.js';
import {movePlan,moveChoices,namedDestinations as destinations} from './composition-commands.js';
import {pointerFor} from './source-map.js';
import {el,button,choose} from './authoring-dom.js';
export function movementControls(view,pkg,node){
 const host=el('fieldset','','editor-movement');host.append(el('legend','Mover por nome (teclado ou toque)'));
 const options=destinations(pkg,node.kind),current=pointerFor(node.path.slice(0,-1));
 const dest=choose('Levar para',options.map(d=>[pointerFor(d.path),d.title]),current),positions=choose('Posição entre os blocos',[]);let choices=[];
 const refresh=()=>{const path=options.find(d=>pointerFor(d.path)===dest.input.value)?.path;choices=moveChoices(pkg,node,path||[]);positions.input.replaceChildren(...choices.map((c,i)=>{const option=el('option',c.label);option.value=String(i);return option;}));};dest.input.addEventListener('change',refresh);refresh();host.append(dest.wrap,positions.wrap);
 host.append(button('Revisar movimento',()=>view.run(async()=>{
  const revision=view.session.revision,destination=options.find(d=>pointerFor(d.path)===dest.input.value)?.path,to=choices[Number(positions.input.value)]?.to,plan=movePlan(pkg,node,destination,to);
  if(!await view.confirm('Mover '+node.title+' para '+dest.input.selectedOptions[0].textContent+' · '+positions.input.selectedOptions[0].textContent+'? Dados e regras vinculados permanecem compartilhados.'))return;
  if(revision!==view.session.revision)throw new Error('A revisão mudou. Revise o movimento novamente.');view.commit(plan.commands,'Mover por destino e nome',plan.selection);
 })));return host;
}
