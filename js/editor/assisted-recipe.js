import {assistedRecipePlan} from './assisted-plans.js';
import {dataIndex,displayData} from './data-index.js';
import {itemFields} from './data-picker.js';
import {numberFromText} from './form-commands.js';
import {mountLiteral} from './literal-editor.js';
import {el,input,choose,button} from './authoring-dom.js';

export const ASSISTED_RECIPES=['slotTracker','skillCatalog','traitAllocation','stateList','inventorySummary'];
export function mountAssistedRecipe(host,{pkg,type,state={},notify}) {
 const reads={};
 const text=(parent,label,key,initial='')=>{const c=input(label,state[key]??initial);parent.append(c.wrap);c.input.addEventListener('input',()=>{state[key]=c.input.value;notify?.();});return c.input;};
 const select=(parent,label,key,options,initial='')=>{const c=choose(label,options,state[key]??initial);parent.append(c.wrap);c.input.addEventListener('change',()=>{state[key]=c.input.value;notify?.();});return c.input;};
 const number=(parent,label,key,initial)=>{const c=text(parent,label,key,initial);reads[key]=()=>numberFromText(c.value);return c;};
 const yes=(label,key)=>select(host,label,key,[['no','Não'],['yes','Sim']],'no');
 const rows=(parent,title,key,initial,draw)=>{state[key]??=structuredClone(initial);const wrap=el('fieldset');wrap.append(el('legend',title));const list=el('div');wrap.append(list);parent.append(wrap);let readers=[];
  const render=()=>{list.replaceChildren();readers=state[key].map((row,i)=>{const box=el('fieldset');box.append(el('legend',title+' '+(i+1)));list.append(box);const read=draw(box,row,i);box.append(button('Remover '+title+' '+(i+1),()=>{state[key].splice(i,1);render();notify?.();}));return read;});};
  wrap.append(button('Acrescentar '+title,()=>{if(state[key].length>=100)return;state[key].push(structuredClone(initial[0]||{}));render();notify?.();}));render();return ()=>readers.map(r=>r());};
 const rowInput=(box,row,label,key,initial='')=>{const c=input(label,row[key]??initial);box.append(c.wrap);c.input.addEventListener('input',()=>{row[key]=c.input.value;notify?.();});return c.input;};
 const rowSelect=(box,row,label,key,options,initial)=>{const c=choose(label,options,row[key]??initial);box.append(c.wrap);c.input.addEventListener('change',()=>{row[key]=c.input.value;notify?.();});return c.input;};
 let scaleRead=()=>pkg.system.dieScale;
 if(['skillCatalog','traitAllocation','stateList'].includes(type)){
  host.append(el('p','A escala é compartilhada pelo sistema. A revisão mostra sua alteração antes de incluir. Nenhum custo de criação ou evolução é inferido.','editor-note'));
  const read=rows(host,'passo da escala','scale',(pkg.system.dieScale||[4,6,8,10,12]).map(faces=>({faces:String(faces)})),(box,row,i)=>{const v=rowInput(box,row,'Faces do passo '+(i+1),'faces');return ()=>numberFromText(v.value,{integer:true});});scaleRead=read;
 }
 let read;
 if(type==='slotTracker'){
  const rs=rows(host,'nível de usos','levels',[{level:'1',max:'',used:'0'}],(box,row,i)=>{const level=rowInput(box,row,'Nível '+(i+1),'level'),max=rowInput(box,row,'Máximo de usos '+(i+1),'max'),used=rowInput(box,row,'Usos iniciais '+(i+1),'used');return ()=>({level:numberFromText(level.value,{integer:true}),max:numberFromText(max.value,{integer:true}),used:numberFromText(used.value,{integer:true})});});
  const display=select(host,'Mostrar o recurso como','display',[['used','Usos gastos'],['remaining','Usos disponíveis']],'used');
  const consume=select(host,'Preferência de consumo','consumeField',[['','Sem preferência'],['new','Criar preferência desligada'],...dataIndex(pkg).filter(r=>r.scope==='character'&&r.type==='boolean').map(r=>[r.field,displayData(r)])]);
  host.append(el('p','O contador acompanha usos e limite. Consumo por ação exige vincular uma rolagem ao mesmo recurso.','editor-note'));
  read=()=>({rows:rs(),display:display.value,...(consume.value==='new'?{newPreference:true,consume:false}:consume.value?{consumeField:consume.value}:{})});
 } else if(type==='skillCatalog'){
  const base=number(host,'Faces do dado base','baseDie',pkg.system.dieScale?.[0]??'4'),composite=yes('Permitir traços compostos','composite');
  const categories=rows(host,'categoria','categories',[{label:'',skills:[{name:''}]}],(box,row,i)=>{
   const label=rowInput(box,row,'Nome da categoria '+(i+1),'label');row.skills??=[{name:''}];const list=el('div');box.append(list);let fields=[];
   const render=()=>{list.replaceChildren();fields=row.skills.map((skill,j)=>{const c=rowInput(list,skill,'Perícia '+(j+1)+' da categoria '+(i+1),'name');list.append(button('Remover perícia '+(j+1)+' da categoria '+(i+1),()=>{row.skills.splice(j,1);render();notify?.();}));return c;});};render();box.append(button('Acrescentar perícia à categoria '+(i+1),()=>{row.skills.push({name:''});render();notify?.();}));return ()=>({label:label.value,skills:fields.map(f=>f.value)});
  });read=()=>({baseDie:reads.baseDie(),allowComposite:composite.value==='yes',categories:categories()});
 } else if(type==='traitAllocation'){
  const traits=rows(host,'traço','traits',[{label:''}],(box,row,i)=>{const label=rowInput(box,row,'Nome do traço '+(i+1),'label');return ()=>({label:label.value});});
  number(host,'Faces do dado inicial dos traços','initialDie',pkg.system.dieScale?.[0]??'4');
  const presets=rows(host,'conjunto','presets',[{label:'',dice:[{faces:'4'}]}],(box,row,i)=>{
   const label=rowInput(box,row,'Nome do conjunto '+(i+1),'label'),list=el('div');box.append(list);row.dice??=[{faces:'4'}];let fields=[];
   const render=()=>{list.replaceChildren();fields=row.dice.map((d,j)=>{const v=rowInput(list,d,'Faces do dado '+(j+1)+' do conjunto '+(i+1),'faces');list.append(button('Remover dado '+(j+1)+' do conjunto '+(i+1),()=>{row.dice.splice(j,1);render();notify?.();}));return v;});};render();box.append(button('Acrescentar dado ao conjunto '+(i+1),()=>{row.dice.push({faces:'4'});render();notify?.();}));return ()=>({label:label.value,dice:fields.map(v=>numberFromText(v.value,{integer:true}))});
  });host.append(el('p','Os dados de cada conjunto seguem a ordem dos traços. Aplicar o conjunto no ensaio substitui os valores desses traços, preservando outros campos.','editor-note'));read=()=>({traits:traits(),presets:presets(),initialDie:reads.initialDie()});
 } else if(type==='stateList'){
  const recovery=yes('Oferecer redução e cura de estado','recovery'),overflow=yes('Vincular outro estado ao ultrapassar a escala','overflow');
  const detail=el('div');host.append(detail);text(detail,'Nome dos estados vinculados','overflowName');number(detail,'Faces iniciais do estado vinculado','startDie',pkg.system.dieScale?.[0]??'4');
  const flags=(key,title)=>rows(detail,title,key,[],(box,row,i)=>{
   const field=rowSelect(box,row,'Dado de '+title+' '+(i+1),'field',[['','Escolha um dado'],...dataIndex(pkg).filter(r=>r.scope==='character'&&['boolean','number','string','null'].includes(r.type)).map(r=>[r.field,displayData(r)])],'');
   const typed=el('div');box.append(typed);row.literal??={};const literal=mountLiteral(typed,{state:row.literal,notify});return ()=>{if(!field.value)throw new Error('Escolha o dado alterado ao ultrapassar a escala.');return {field:field.value,value:literal()};};
  });const first=flags('onFirst','primeiro limite'),limit=flags('onLimit','limite vinculado');
  const show=()=>{detail.hidden=overflow.value!=='yes';};overflow.addEventListener('change',show);show();
  host.append(el('p','Esta família usa estados por degraus de dados e as mensagens atuais de Desgaste/Trauma. Não oferece uma máquina universal de condições; consequências narrativas são confirmadas pela mesa.','editor-note'));
  read=()=>({recovery:recovery.value==='yes',overflow:overflow.value==='yes',...(overflow.value==='yes'?{overflowName:state.overflowName,startDie:reads.startDie(),onFirst:first(),onLimit:limit()}:{})});
 } else if(type==='inventorySummary'){
  const mode=select(host,'Origem dos itens de carga','collection',[['','Criar itens, capacidade e multiplicador'],...dataIndex(pkg).filter(r=>r.scope==='character'&&r.type==='collection').map(r=>[r.field,displayData(r)])]);const body=el('div');host.append(body);let existingRead;
  const render=()=>{body.replaceChildren();if(!mode.value){number(body,'Capacidade base inicial','strength','');number(body,'Multiplicador inicial de carga','multiplier','');existingRead=()=>({strength:reads.strength(),multiplier:reads.multiplier()});return;}
   const controls={};for(const [key,label,types]of [['weightField','Peso de cada item',['number']],['quantityField','Quantidade de cada item',['number']],['carriedField','Marca de item carregado',['boolean']]])controls[key]=select(body,label,key,[['',key==='carriedField'?'Todos os itens':'Escolha um campo'],...itemFields(pkg,mode.value).filter(r=>types.includes(r.type)).map(r=>[r.key,r.label])]);
   for(const [key,label]of [['strengthField','Dado de capacidade base'],['multiplierField','Dado do multiplicador']])controls[key]=select(body,label,key,[['','Escolha um dado'],...dataIndex(pkg).filter(r=>r.scope==='character'&&r.type==='number').map(r=>[r.field,displayData(r)])]);existingRead=()=>Object.fromEntries(Object.entries(controls).map(([key,c])=>[key,c.value]));
  };mode.addEventListener('change',render);render();host.append(el('p','Peso = peso por item × quantidade. Capacidade = maior dado/valor base × multiplicador. Sobrecarga informa o excesso; a mesa define penalidades.','editor-note'));read=()=>({collection:mode.value,...existingRead()});
 }
 return ({name,destination})=>assistedRecipePlan(pkg,{type,name,destination,config:{...read(),scale:scaleRead()}});
}
