import {test,expect} from '@playwright/test';
import {open,data,component,panel,current,confirm,frame} from '../helpers/typed-authoring.mjs';
import {resolutionPortId} from '../../js/engine/resolution-results.js';
test.use({actionTimeout:15000});
const ports={source:'Editar coleção fonte tipada',value:'Editar valor tipado',key:'Editar identidade procurada'};
async function edit(builder,node){
 await builder.getByLabel('Operação tipada desta parte',{exact:true}).selectOption(node.op);
 if(node.op==='literal'){
  await builder.getByLabel('Tipo do valor literal tipado',{exact:true}).selectOption(typeof node.value);
  await builder.getByLabel(typeof node.value==='number'?'Número da operação tipada':'Texto da operação tipada',{exact:true}).fill(String(node.value));
 }
 if(node.localId)await builder.getByLabel('Resultado anterior da operação',{exact:true}).selectOption(node.localId);
 if(node.fieldId)await builder.getByLabel('Campo do registro na operação tipada',{exact:true}).selectOption(node.fieldId);
 for(const [key,label]of Object.entries(ports))if(node[key]&&typeof node[key]==='object'){await builder.getByRole('button',{name:label,exact:true}).click();await edit(builder,node[key]);await builder.getByRole('button',{name:'Parte tipada anterior',exact:true}).click();}
}
async function expression(host,label,node){const box=host.getByText(label,{exact:true}).locator('xpath=parent::details');await box.locator(':scope > summary').click();await edit(box,node);await box.locator(':scope > summary').click();}
async function step(host,type,label){await host.getByLabel('Tipo da nova etapa',{exact:true}).selectOption(type);await host.getByRole('button',{name:'Adicionar etapa tipada',exact:true}).click();const control=host.getByLabel(/^Nome da etapa /).last(),id=(await control.getAttribute('aria-label')).slice('Nome da etapa '.length);await control.fill(label);return id;}
const property=(id,name,value)=>({op:'property',fieldId:resolutionPortId(id,name),value});
const groups=id=>property(id,'groups',{op:'local',localId:id});
const totals=id=>({op:'map',source:groups(id),value:property(id,'groups_total',{op:'item'})});
async function outputs(page,names){const result=[];for(const name of names){const d=await data(page,name,0);await component(page,d);result.push(d);}return result;}
async function execute(page,label,faces){
 await page.getByRole('button',{name:'Experimentar',exact:true}).click();const runtime=frame(page);await expect(runtime.getByRole('button',{name:label,exact:true})).toBeVisible();
 // Deterministic test RNG only; the package and sandbox CSP are unchanged.
 await runtime.locator('html').evaluate((_,faces)=>{const native=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=values=>{if(values instanceof Uint32Array){for(let i=0;i<values.length;i++){const draw=faces.shift();if(!draw)throw Error('Lançamento inesperado no teste');values[i]=Math.floor(0x100000000/draw[0])*(draw[1]-1);}return values;}return native(values);};},faces);
 await runtime.getByRole('button',{name:label,exact:true}).click();await runtime.getByRole('button',{name:'Resolver prévia',exact:true}).click();return runtime;
}
test('AV-10 portas: Pool composto é configurado por operações e não soma cada face como fonte independente',async({page})=>{
 test.setTimeout(180000);await open(page);const ds=await outputs(page,['Ápice','Base','Peso']);const host=await panel(page,'.editor-action-authoring');await host.getByLabel('Nome da ação tipada',{exact:true}).fill('Consultar fontes');const resolve=await step(host,'resolve','Lançamentos');
 for(const [label,dice]of [['Composta',[8,6]],['Simples',[4]]]){
  await host.getByRole('button',{name:/^Adicionar grupo em /}).click();const control=host.getByLabel(/^Nome do grupo /).last(),id=(await control.getAttribute('aria-label')).slice('Nome do grupo '.length);await control.fill(label);
  for(const [index,sides]of dice.entries()){await host.getByRole('button',{name:'Adicionar fonte em '+id,exact:true}).click();await expression(host,'Fonte '+id+' '+index,{op:'literal',value:sides});}
 }
 const values=[];for(const [index,op]of ['max','min','sum'].entries()){const id=await step(host,'value',ds[index].label);await expression(host,'Valor produzido por '+id,{op,source:totals(resolve)});values.push(id);}
 for(const [index,d]of ds.entries()){const id=await step(host,'set','Registrar '+d.label);await host.getByLabel('Destino da consequência '+id,{exact:true}).selectOption(d.id);await expression(host,'Valor da consequência '+id,{op:'local',localId:values[index]});}
 await host.getByRole('button',{name:'Revisar ação tipada',exact:true}).click();await confirm(page);const canonical=await current(page),runtime=await execute(page,'Consultar fontes',[[8,4],[6,3],[4,2]]);await runtime.getByRole('button',{name:'Cancelar prévia',exact:true}).click();for(const d of ds)await expect(runtime.getByLabel(d.label,{exact:true})).toHaveValue('0');await runtime.locator('html').evaluate(()=>{const native=crypto.getRandomValues.bind(crypto),faces=[[8,4],[6,3],[4,2]];crypto.getRandomValues=values=>{if(values instanceof Uint32Array){for(let i=0;i<values.length;i++){const draw=faces.shift();if(!draw)throw Error('Lançamento inesperado no teste');values[i]=Math.floor(0x100000000/draw[0])*(draw[1]-1);}return values;}return native(values);};});await runtime.getByRole('button',{name:'Consultar fontes',exact:true}).click();await runtime.getByRole('button',{name:'Resolver prévia',exact:true}).click();await runtime.getByRole('button',{name:'Confirmar resultado',exact:true}).click();for(const [index,d]of ds.entries())await expect(runtime.getByLabel(d.label,{exact:true})).toHaveValue(String([7,2,9][index]));expect(await current(page)).toEqual(canonical);
});
test('AV-10 portas: percentil expõe candidatos compartilhados para mínimo e máximo pela UI',async({page})=>{
 test.setTimeout(180000);await open(page);const ds=await outputs(page,['Menor candidato','Maior candidato']);const host=await panel(page,'.editor-action-authoring');await host.getByLabel('Nome da ação tipada',{exact:true}).fill('Consultar percentil');const resolve=await step(host,'resolve','Percentual');await host.getByRole('button',{name:/^Adicionar grupo em /}).click();const group=(await host.getByLabel(/^Nome do grupo /).getAttribute('aria-label')).slice('Nome do grupo '.length);await host.getByLabel('Primitiva do grupo '+group,{exact:true}).selectOption('sharedPercentile');await expression(host,'Saldo do percentil '+group,{op:'literal',value:1});
 const candidates=property(resolve,'groups_candidates',{op:'lookup',source:groups(resolve),key:{op:'literal',value:group}}),list={op:'map',source:candidates,value:property(resolve,'groups_candidates_value',{op:'item'})};const values=[];for(const [index,op]of ['min','max'].entries()){const id=await step(host,'value',ds[index].label);await expression(host,'Valor produzido por '+id,{op,source:list});values.push(id);}
 for(const [index,d]of ds.entries()){const id=await step(host,'set','Registrar '+d.label);await host.getByLabel('Destino da consequência '+id,{exact:true}).selectOption(d.id);await expression(host,'Valor da consequência '+id,{op:'local',localId:values[index]});}
 await host.getByRole('button',{name:'Revisar ação tipada',exact:true}).click();await confirm(page);const canonical=await current(page),runtime=await execute(page,'Consultar percentil',[[10,1],[10,1],[10,6]]);await runtime.getByRole('button',{name:'Confirmar resultado',exact:true}).click();await expect(runtime.getByLabel('Menor candidato',{exact:true})).toHaveValue('50');await expect(runtime.getByLabel('Maior candidato',{exact:true})).toHaveValue('100');expect(await current(page)).toEqual(canonical);
});
