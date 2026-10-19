export const WORKSPACE_AREAS=Object.freeze([['overview','Visão geral','grid'],['sheet','Ficha','document'],['data','Dados','table'],['rules','Regras','connections'],['test','Testar','play'],['review','Revisar','checklist']]);
export const DOMAIN_PANELS=Object.freeze({data:[['typed','Valores do personagem','editor-typed-data'],['structured','Registros, coleções e compostos','editor-structured-authoring'],['catalogs','Dados e catálogos legados','editor-data-panel'],['properties','Propriedades completas','editor-inspector']],rules:[['calculations','Cálculos e consultas','editor-typed-rules'],['actions','Ações e resoluções','editor-action-authoring'],['events','Eventos e gatilhos','editor-trigger-authoring'],['effects','Efeitos temporários','editor-typed-effect-authoring'],['progression','Criação e evolução','editor-progression-authoring'],['connections','Fontes, condições e grafo','editor-rule-graph'],['legacy','Regras e propriedades completas','editor-inspector']]});
export function workspaceArea(mode){return ({visual:'sheet',experiment:'test',forms:'code',json:'code'})[mode]||'overview';}
export function workspaceMode(area,technicalMode='json'){return area==='test'?'experiment':area==='code'?(technicalMode==='forms'?'forms':'json'):'visual';}
export function recoverWorkspace(ui={},source={},valid=true){
 const stored=ui.workspace&&typeof ui.workspace==='object'&&!Array.isArray(ui.workspace)?ui.workspace:{};
 const area=!valid?'code':[...WORKSPACE_AREAS.map(([id])=>id),'code'].includes(stored.area)?stored.area:ui.mode?workspaceArea(ui.mode):source.kind==='new'||!source.kind?'overview':'sheet';
 return {...stored,area,panel:['canvas','tools','properties'].includes(stored.panel)?stored.panel:'canvas',tool:['structure','add','layouts'].includes(stored.tool)?stored.tool:'structure',dataPanel:DOMAIN_PANELS.data.some(([id])=>id===stored.dataPanel)?stored.dataPanel:'typed',rulesPanel:DOMAIN_PANELS.rules.some(([id])=>id===stored.rulesPanel)?stored.rulesPanel:'calculations',technicalMode:stored.technicalMode==='forms'||ui.mode==='forms'?'forms':'json'};
}
export function diagnosticDestination(pointer=''){
 if(/^\/layouts\//.test(pointer))return {area:'sheet',panel:'properties'};
 if(/^\/system\/(dataDefinitions|catalogs|componentDefinitions|characterTemplate)/.test(pointer))return {area:'data',dataPanel:'properties'};
 if(/^\/system\//.test(pointer))return {area:'rules',rulesPanel:'legacy'};
 return {area:'code'};
}
