// User-facing navigation helpers; no application-state injection.
export async function editorProperties(page){
 if(await page.locator('#view-editor').getAttribute('data-workspace-area')!=='sheet')return;
 const props=page.locator('.workspace-properties');if(!await props.isVisible())await page.locator('[data-workspace-panel=properties]').click();
 for(const group of await props.locator('details.editor-property-group,details.workspace-element-actions').all())if(await group.getAttribute('open')===null)await group.locator(':scope>summary').click();
}
export async function editorSelect(page,target){await editorArea(page,'sheet');await editorTool(page,'structure');await target.click();await editorProperties(page);}
export async function editorExpand(page,target){
 for(const ancestor of await target.locator('xpath=ancestor::details').all())if(await ancestor.getAttribute('open')===null)await ancestor.locator(':scope>summary').click();
 if(await target.getAttribute('open')===null)await target.locator(':scope>summary').click();
}
export async function editorArea(page,id){
 if(await page.locator('.workspace-area-select').isVisible())await page.getByLabel('Área de autoria',{exact:true}).selectOption(id);
 else await page.locator('button[data-workspace-area="'+id+'"]').click();
}
export async function editorMode(page,mode){
 if(await page.locator('#view-editor').getAttribute('data-workspace-area')==='code'&&await page.locator('#view-editor').getAttribute('data-authoring-mode')===mode)return;
 if(mode==='visual')return editorArea(page,'sheet');if(mode==='experiment')return editorArea(page,'test');
 await page.locator('.workspace-technical>summary').click();await page.getByRole('button',{name:mode==='forms'?'Editar por formulários':'Editar JSON',exact:true}).click();
}
export async function editorTool(page,tool){
 const tools=page.locator('.workspace-tools');if(!await tools.isVisible())await page.locator('.workspace-panel-nav [data-workspace-panel=tools]').click();
 await tools.getByRole('button',{name:{structure:'Estrutura',add:'Adicionar',layouts:'Layouts'}[tool],exact:true}).click();
}
export async function editorFamily(page,area,id){
 await editorArea(page,area);if(!await page.locator('.workspace-domain-nav').isVisible())await page.locator('.workspace-panel-nav [data-workspace-panel=tools]').click();
 await page.locator('.workspace-domain-nav button[data-workspace-family="'+id+'"]').click();
}
export async function editorPanel(page,selector){
 const routes={'.editor-typed-data':['data','typed'],'.editor-typed-rules':['rules','calculations'],'.editor-structured-authoring':['data','structured'],'.editor-data-panel':['data','catalogs'],'.editor-action-authoring':['rules','actions'],'.editor-trigger-authoring':['rules','events'],'.editor-typed-effect-authoring':['rules','effects'],'.editor-progression-authoring':['rules','progression'],'.editor-rule-graph':['rules','connections']};
 if(routes[selector])await editorFamily(page,...routes[selector]);else if(selector==='.editor-migration')await editorArea(page,'review');else if(['.editor-toolbox','.editor-layout-manager'].includes(selector)){await editorMode(page,'visual');await editorTool(page,selector==='.editor-toolbox'?'add':'layouts');}
 const host=page.locator(selector);if(await host.evaluate(n=>n.tagName==='DETAILS'&&!n.open))await host.locator(':scope>summary').click();return host;
}
export async function editorCommand(page,label){
 if(['Desfazer JSON','Refazer JSON'].includes(label))return page.getByRole('button',{name:label==='Desfazer JSON'?'Desfazer no editor':'Refazer no editor',exact:true}).click();
 if(['Validar JSON','Formatar JSON','Normalizar aliases'].includes(label)){await page.locator('.workspace-technical>summary').click();return page.getByRole('button',{name:label,exact:true}).click();}
 if(label==='Aplicar pacote'){await editorArea(page,'review');return page.locator('.workspace-header-actions .button--primary').click();}
 const menu=page.locator('.workspace-menu:not(.workspace-technical)');if(!await menu.evaluate(n=>n.open))await menu.locator('summary').click();await page.getByRole('button',{name:label,exact:true}).click();
}
