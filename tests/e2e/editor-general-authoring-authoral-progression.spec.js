import {editorMode,editorCommand,editorArea,editorTool,editorFamily} from '../helpers/editor-workspace-nav.js';
// Author costs and grants through the common UI; no JSON logic injection.
import {test,expect} from '@playwright/test';
import {open,panel,confirm,datum,component,read,n,bin,catalog,catalogEntry,calculation,expr,current,frame,layoutCopy,roundtrip} from '../helpers/general-authoring.mjs';
import {apply,values} from '../helpers/typed-authoring.mjs';
test.use({actionTimeout:15000});
async function option(host,label,{paid=false,narrative=false}={}){
 await host.getByRole('button',{name:'Adicionar opção de progressão',exact:true}).click();const control=host.getByLabel(/^Nome da opção /).last(),id=(await control.getAttribute('aria-label')).slice('Nome da opção '.length);await control.fill(label);
 if(paid){await host.getByLabel('Permitir Evolução paga em '+id,{exact:true}).check();await host.getByLabel('Permitir Criação em '+id,{exact:true}).uncheck();}
 if(narrative)await host.getByLabel('Permitir Concessão narrativa em '+id,{exact:true}).check();return id;
}
async function grant(host,scope,data,sides){
 await host.getByRole('button',{name:'Adicionar concessão em '+scope,exact:true}).click();const control=host.getByLabel(/^Nome da concessão /).last(),id=(await control.getAttribute('aria-label')).slice('Nome da concessão '.length);await control.fill('Conceder '+data.label+' d'+sides);await host.getByLabel('Dado da concessão '+id,{exact:true}).selectOption(data.id);await expr(host,'Valor concedido '+id,{op:'trait',dataId:data.id,dice:[sides]});
}
async function author(page){
 await open(page);const creation=await datum(page,{name:'Reserva inicial',type:'integer',initial:14,minimum:0}),evolution=await datum(page,{name:'Reserva de avanço',type:'integer',initial:5,minimum:0}),cap=await datum(page,{name:'Teto da qualidade',type:'integer',initial:6}),skill=await datum(page,{name:'Eco treinado',type:'trait',initial:4}),specialization=await datum(page,{name:'Eco especializado',type:'trait'});
 for(const data of [creation,evolution,cap,skill,specialization])await component(page,data.label,{data});
 const table=await catalog(page,'Passos escolhidos'),from=await datum(page,{name:'Origem',type:'integer',parent:table,required:true}),to=await datum(page,{name:'Destino',type:'integer',parent:table,required:true}),price=await datum(page,{name:'Preço',type:'integer',parent:table,required:true});
 for(const [a,b,p]of [[0,4,1],[4,6,2],[6,8,4],[8,10,8],[10,12,16]])await catalogEntry(page,table,[[from,a],[to,b],[price,p]]);
 const skillTable=await catalog(page,'Passos de treino'),sf=await datum(page,{name:'Origem',type:'integer',parent:skillTable,required:true}),st=await datum(page,{name:'Destino',type:'integer',parent:skillTable,required:true}),sp=await datum(page,{name:'Preço',type:'integer',parent:skillTable,required:true});
 for(const [a,b,p]of [[4,6,1],[6,8,2],[8,10,4],[10,12,8]])await catalogEntry(page,skillTable,[[sf,a],[st,b],[sp,p]]);
 const step=(data,a,b,special=false)=>({op:'stepCost',dataId:data.id,catalogId:(special?table:skillTable).id,fromFieldId:(special?from:sf).id,toFieldId:(special?to:st).id,costFieldId:(special?price:sp).id,from:n(a),to:n(b)});
 const skillCost=await calculation(page,'Treino d8 desde d4',step(skill,4,8)),specCost=await calculation(page,'Especialização d8 desde zero',step(specialization,0,8,true));for(const rule of [skillCost,specCost])await component(page,rule.label,{rule});
 const cap6=await calculation(page,'Qualidade permite d6',bin('greaterEqual',read(cap),n(6)),{kind:'predicate',type:'boolean'}),cap8=await calculation(page,'Qualidade permite d8',bin('greaterEqual',read(cap),n(8)),{kind:'predicate',type:'boolean'});
 const host=await panel(page,'.editor-progression-authoring');await host.getByLabel('Orçamento da criação tipada',{exact:true}).selectOption(creation.id);await host.getByLabel('Orçamento da evolução tipada',{exact:true}).selectOption(evolution.id);await host.getByLabel('Reabrir criação sem histórico de evolução',{exact:true}).selectOption('true');
 const train=await option(host,'Treinar Eco d6');await host.getByLabel('Requisito da opção '+train,{exact:true}).selectOption(cap6.id);await expr(host,'Custo Criação · '+train,step(skill,4,6));await grant(host,train,skill,6);
 const denied=await option(host,'Treinar Eco d8 na criação');await host.getByLabel('Requisito da opção '+denied,{exact:true}).selectOption(cap8.id);await expr(host,'Custo Criação · '+denied,step(skill,4,8));await grant(host,denied,skill,8);
 const spec=await option(host,'Especializar Eco d6');await expr(host,'Custo Criação · '+spec,step(specialization,0,6,true));await grant(host,spec,specialization,6);
 const advance=await option(host,'Avançar Eco d8',{paid:true,narrative:true});await host.getByLabel('Exigir '+train+' em '+advance,{exact:true}).check();await expr(host,'Custo Evolução paga · '+advance,step(skill,6,8));await grant(host,advance,skill,8);
 await host.getByRole('button',{name:'Revisar progressão tipada',exact:true}).click();await confirm(page);await layoutCopy(page);return {pkg:await current(page),creation,evolution,skill,specialization};
}
async function exercise(runtime,d,{narrative=false}={}){
 const initial=runtime.getByLabel(d.creation.label,{exact:true}),advancement=runtime.getByLabel(d.evolution.label,{exact:true}),skill=runtime.getByLabel(d.skill.label,{exact:true});
 await expect(runtime.locator('.engine-computed__value')).toHaveText(['3','7']);await runtime.getByRole('button',{name:'Revisar aquisição de Treinar Eco d8 na criação',exact:true}).click();await expect(runtime.locator('.engine-progression')).toContainText('Qualidade permite d8: condição não atendida');await expect(initial).toHaveValue('14');await expect(skill).toHaveValue('4');
 await runtime.getByRole('button',{name:'Revisar aquisição de Treinar Eco d6',exact:true}).click();await runtime.getByRole('button',{name:'Cancelar progressão',exact:true}).click();await expect(initial).toHaveValue('14');
 for(const name of ['Treinar Eco d6','Especializar Eco d6']){await runtime.getByRole('button',{name:'Revisar aquisição de '+name,exact:true}).click();await runtime.getByRole('button',{name:'Confirmar progressão',exact:true}).click();}
 await expect(initial).toHaveValue('10');await expect(skill).toHaveValue('6');await expect(runtime.getByLabel(d.specialization.label,{exact:true})).toHaveValue('6');
 await runtime.getByRole('button',{name:'Concluir criação tipada',exact:true}).click();await runtime.getByRole('button',{name:'Confirmar progressão',exact:true}).click();await expect(runtime.locator('.engine-progression')).toContainText('Snapshot inicial: gastos 4 · sobra 10');await expect(advancement).toHaveValue('5');
 await runtime.getByRole('button',{name:'Reabrir criação tipada',exact:true}).click();await runtime.getByRole('button',{name:'Confirmar progressão',exact:true}).click();await runtime.getByRole('button',{name:'Concluir criação tipada',exact:true}).click();await runtime.getByRole('button',{name:'Confirmar progressão',exact:true}).click();
 if(narrative)await runtime.getByLabel('Origem de Avançar Eco d8',{exact:true}).selectOption('narrative');await runtime.getByRole('button',{name:'Revisar aquisição de Avançar Eco d8',exact:true}).click();await runtime.getByRole('button',{name:'Confirmar progressão',exact:true}).click();await expect(skill).toHaveValue('8');await expect(advancement).toHaveValue(narrative?'5':'3');await expect(initial).toHaveValue('10');
 await skill.selectOption('10');await expect(advancement).toHaveValue(narrative?'5':'3');await expect(runtime.locator('.engine-progression')).toContainText('Snapshot inicial: gastos 4 · sobra 10');await skill.selectOption('8');
 await runtime.getByRole('button',{name:'Reabrir criação tipada',exact:true}).click();await expect(runtime.locator('.engine-progression')).toContainText('ausência de histórico de evolução');
}
test('AV-10 B: escala e tabelas visuais separam criação, melhoria paga e narrativa com proveniência',async({page,browser},info)=>{
 test.setTimeout(420000);const d=await author(page);await editorMode(page,'experiment');await exercise(frame(page),d);expect(await current(page)).toEqual(d.pkg);await roundtrip(page,browser,info,d.pkg,runtime=>exercise(runtime,d,{narrative:true}));
 await apply(page,d.pkg);await exercise(page,d);const character=await values(page);expect(character.progressionLedger.records.map(r=>[r.mode,r.cost.amount])).toEqual([['creation',1],['creation',3],['paid',2]]);expect(character.progressionLedger.creationSnapshot.spent).toBe(4);expect(character.progressionLedger.creationSnapshot.remaining).toBe(10);const identities=character.progressionLedger.records.map(r=>r.id);
 await page.locator('#btn-undo-edit').click();await page.locator('#btn-redo-edit').click();expect((await values(page)).progressionLedger.records.map(r=>r.id)).toEqual(identities);
});
