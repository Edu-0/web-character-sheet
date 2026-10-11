import {test} from 'node:test';
import assert from 'node:assert/strict';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {EditorSession} from '../../js/editor/session.js';
import {prepareDocument} from '../../js/validation/documents.js';
import {createTypedDataPlan,addTypedFieldPlan,createCatalogPlan} from '../../js/editor/typed-data-commands.js';
import {dataDefinition,readData,writeData,initializeData} from '../../js/engine/data-definitions.js';
import {typedValueIssue} from '../../js/engine/data-types.js';
import {expandComponents} from '../../js/engine/layout-components.js';
import {buildSearchIndex} from '../../js/engine/search.js';
import {createComponentDefinitionPlan,detachComponentPlan,copyComponentDefinitionPlan} from '../../js/editor/component-definition-commands.js';
import {structuralNodes,destinations,structureCommand} from '../../js/editor/form-structure.js';
import {previewSources} from '../../js/editor/source-navigation.js';
import {writeValidatedData} from '../../js/engine/typed-data-write.js';
import {knownReferences} from '../../js/editor/references.js';
import {typedComponentValue,typedSearchRecords,formatTypedCell} from '../../js/engine/typed-value-format.js';
import {componentsForPrint} from '../../js/engine/print-profile.js';
import {movePlan} from '../../js/editor/composition-commands.js';
const location=['layouts',0,'tabs',0,'sections',0,'containers',0,'components'];
const ready=p=>assert.equal(prepareDocument(p,{kind:'package'}).status,'ready',JSON.stringify(prepareDocument(p,{kind:'package'}).diagnostics));
const components=p=>p.layouts[0].tabs[0].sections[0].containers[0].components;
const session=()=>new EditorSession({text:JSON.stringify(minimalPackage('structured'))});
test('AV-02 áreas vazias de composição só existem na prévia e não inventam entradas',()=>{
 const s=session(),collection=datum(s,{name:'Entradas',type:'collection'}),name=field(s,collection,{name:'Nome',type:'string'}),p=s.validation.value,c=structuredClone(p.system.characterTemplate),before=structuredClone(c);
 const container={components:[{type:'group',components:[]},{type:'group',repeat:{scope:'character',dataId:collection.id},components:[{type:'dataField',dataId:name.id}]}]};
 assert.deepEqual(expandComponents(container,p.system,c),[]);const preview=expandComponents(container,p.system,c,{includeEmptyGroups:true,sourcePath:['containers',0]});assert.equal(preview.length,2);assert.deepEqual(preview[1].sourcePath,['containers',0,'components',1]);assert.deepEqual(preview[1].occurrenceIds,[]);assert.equal(preview[1].dataId,undefined);assert.deepEqual(c,before);
});
test('AV-02 grupos aninhados herdam escopo; coleção vazia não esconde vínculo inválido',()=>{
 const s=session(),outer=datum(s,{name:'Equipamentos',type:'collection',hasInitial:true,initial:[]}),inner=field(s,outer,{name:'Módulos',type:'collection',hasInitial:true,initial:[]}),weight=field(s,inner,{name:'Peso',type:'number'}),p=s.validation.value;
 components(p).push({type:'group',repeat:{scope:'character',dataId:outer.id},components:[{type:'group',repeat:{scope:'character',dataId:inner.id},components:[{type:'group',components:[{type:'dataField',dataId:weight.id}]}]}]});ready(p);
 components(p)[0].components[0].repeat.dataId=outer.id;const invalid=prepareDocument(p,{kind:'package'});assert.equal(invalid.status,'invalid');assert.ok(invalid.diagnostics.some(d=>d.message.includes('Módulos')));
});
test('AV-02 movimento não confunde objeto JSON com interpolação de repetição legada',()=>{
 const s=session(),collection=datum(s,{name:'Entradas',type:'collection'}),p=s.validation.value;components(p).push({type:'group',label:'Destino',repeat:{scope:'character',dataId:collection.id},components:[{type:'number',label:'Número',field:'score'}]});
 const child=structuralNodes(p).find(n=>n.value?.type==='number');assert.doesNotThrow(()=>movePlan(p,child,location,0));
 components(p)[0].repeat={source:'entries'};child.value.field='entries.{index}.score';assert.throws(()=>movePlan(p,child,location,0),/entradas da repetição/);
 child.value.field='score';child.value.extensions={note:'{literal}'};assert.doesNotThrow(()=>movePlan(p,child,location,0));
});
function datum(s,settings){const plan=createTypedDataPlan(s.validation.value,settings);s.operate(plan.commands);return plan.definition;}
function field(s,parent,settings){const plan=addTypedFieldPlan(s.validation.value,parent.id,settings);s.operate(plan.commands);return plan.definition;}

test('AV-02 repetir a mesma coleção na cadeia é inválido mesmo vazia e a execução recusa ambiguidade',()=>{
 const s=session(),list=datum(s,{name:'Entradas',type:'collection',hasInitial:true,initial:[]}),p=s.validation.value;
 const group={type:'group',repeat:{scope:'character',dataId:list.id},components:[{type:'group',repeat:{scope:'character',dataId:list.id},components:[]}]};components(p).push(group);
 const result=prepareDocument(p,{kind:'package'});assert.equal(result.status,'invalid');assert.ok(result.diagnostics.some(d=>d.message.includes('mesma coleção')));
 const c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeData(p.system,c,list.id,{present:true,value:[{id:'a'}]});assert.throws(()=>expandComponents({components:[group]},p.system,c),/mesma coleção/);
});

test('AV-02 catálogo referencia somente catálogo, incluindo campos profundamente aninhados',()=>{
 const s=session(),list=datum(s,{name:'Entradas',type:'collection'}),catalog=createCatalogPlan(s.validation.value,'Rotas');s.operate(catalog.commands);
 const record=field(s,catalog.catalog,{name:'Detalhes',type:'record'});field(s,record,{name:'Destino',type:'reference',target:{scope:'system',catalogId:catalog.catalog.id},multiple:false});ready(s.validation.value);
 const p=s.validation.value;p.system.catalogs[0].fields[0].fields[0].target={scope:'character',dataId:list.id};const result=prepareDocument(p,{kind:'package'});assert.equal(result.status,'invalid');assert.ok(result.diagnostics.some(d=>d.message.includes('Referência de catálogo')));
});

test('AV-02 enums/traços e restrições preservam tipos e identidades',()=>{
 const s=session(),choice=datum(s,{name:'Rota',type:'enum',options:[{id:'short',label:'Curta'},{id:'long',label:'Profunda'}],hasInitial:true,initial:'short'}),trait=datum(s,{name:'Sondagem',type:'trait',scale:[4,6,8],composite:true,hasInitial:true,initial:[6,4]});ready(s.validation.value);
 const c=initializeData(s.validation.value.system,structuredClone(s.validation.value.system.characterTemplate));assert.equal(readData(s.validation.value.system,c,choice.id).value,'short');assert.deepEqual(readData(s.validation.value.system,c,trait.id).value,[6,4]);assert.throws(()=>writeData(s.validation.value.system,c,choice.id,{present:true,value:'missing'}),/opção/);assert.throws(()=>writeData(s.validation.value.system,c,trait.id,{present:true,value:6}),/traço/);
 assert.match(typedValueIssue({type:'number',minimum:0,maximum:10},-1),/mínimo/);assert.match(typedValueIssue({type:'string',maxLength:2},'abc'),/tamanho/);
});

test('AV-02 registro/coleção validam valores independentemente dos componentes',()=>{
 const s=session(),collection=datum(s,{name:'Ofícios',type:'collection',hasInitial:true,initial:[]}),name=field(s,collection,{name:'Nome',type:'string',required:true,hasInitial:true,initial:''}),weight=field(s,collection,{name:'Peso',type:'integer',hasInitial:true,initial:0});ready(s.validation.value);
 const p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));c.meta.id='c';writeData(p.system,c,collection.id,{present:true,value:[{id:'first',[name.binding]:'Mapa',[weight.binding]:0}]});assert.equal(prepareDocument(c,{kind:'character',pkg:p}).status,'ready');
 for(const invalid of [[{id:'first'}],[{id:'first',[name.binding]:'A'},{id:'first',[name.binding]:'B'}],[{id:'first',[name.binding]:'A',[weight.binding]:1.5}]])assert.throws(()=>writeData(p.system,c,collection.id,{present:true,value:invalid}));
 assert.equal(readData(p.system,c,weight.id,{entries:[{dataId:collection.id,entryId:'first'}]}).value,0);assert.equal(dataDefinition(p.system,weight.id).label,'Peso');
});

test('AV-02 entrada por identidade continua correta após reorder e não captura índice',()=>{
 const s=session(),collection=datum(s,{name:'Módulos',type:'collection',hasInitial:true,initial:[]}),weight=field(s,collection,{name:'Peso',type:'integer',hasInitial:true,initial:0});const p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeData(p.system,c,collection.id,{present:true,value:[{id:'a',[weight.binding]:2},{id:'b',[weight.binding]:3}]});const context={entries:[{dataId:collection.id,entryId:'a'}]};
 writeData(p.system,c,collection.id,{present:true,value:readData(p.system,c,collection.id).value.toReversed()});writeData(p.system,c,weight.id,{present:true,value:9},context);assert.equal(c[collection.binding][1][weight.binding],9);assert.equal(c[collection.binding][0][weight.binding],3);assert.throws(()=>readData(p.system,c,weight.id,{entries:[{dataId:collection.id,entryId:'deleted'}]}),/inexistente/);
});

test('AV-02 catálogo/referência apontam para original e destino ausente bloqueia',()=>{
 const s=session(),catalog=createCatalogPlan(s.validation.value,'Rotas');s.operate(catalog.commands);const price=field(s,catalog.catalog,{name:'Preço',type:'number'});s.operate([{type:'insertNode',path:['system','catalogs',0,'entries'],index:0,value:{id:'free',[price.binding]:0}}]);const reference=datum(s,{name:'Rota escolhida',type:'reference',target:{scope:'system',catalogId:catalog.catalog.id},multiple:false});ready(s.validation.value);
 const p=s.validation.value,c=structuredClone(p.system.characterTemplate);c.meta.id='c';writeData(p.system,c,reference.id,{present:true,value:'free'});assert.equal(prepareDocument(c,{kind:'character',pkg:p}).status,'ready');c[reference.binding]='missing';assert.equal(prepareDocument(c,{kind:'character',pkg:p}).status,'invalid');assert.equal(p.system.catalogs[0].entries[0][price.binding],0);
});

test('AV-02 grupos/informação/vazio/repeat usam projeção comum e fonte original',()=>{
 const s=session(),collection=datum(s,{name:'Ofícios',type:'collection',hasInitial:true,initial:[]}),name=field(s,collection,{name:'Nome',type:'string',hasInitial:true,initial:''});const p=s.validation.value;components(p).push({type:'information',label:'Orientação',text:'<script>texto seguro</script>'},{type:'group',label:'Ofícios',repeat:{scope:'character',dataId:collection.id},components:[{type:'dataField',dataId:name.id,label:'Nome'}]},{type:'group',label:'Vazio intencional',components:[]});ready(p);
 const c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeData(p.system,c,collection.id,{present:true,value:[{id:'a',[name.binding]:'Cartógrafo'},{id:'b',[name.binding]:'Guia'}]});const container=p.layouts[0].tabs[0].sections[0].containers[0],expanded=expandComponents(container,p.system,c,{sourcePath:location.slice(1,-1)});assert.equal(expanded.length,4);assert.deepEqual(expanded[1].occurrenceIds,['a']);assert.deepEqual(expanded[2].occurrenceIds,['b']);assert.equal(expanded[1].dataId,name.id);assert.ok(expanded[1].sourcePath.includes('components'));assert.ok(buildSearchIndex(p.layouts[0],c,p.system).some(e=>e.value.includes('Cartógrafo')));
 for(const version of [1,2]){const old=structuredClone(p);old.schemaVersion=old.system.schemaVersion=old.layouts[0].schemaVersion=version;assert.equal(prepareDocument(old,{kind:'package'}).status,'invalid');}
 const empty=structuredClone(p);empty.layouts[0].tabs[0].sections=[];ready(empty);
});

test('AV-02 composto local compartilha apresentação, copia/desvincula e conserva vínculos',()=>{
 const s=session(),a=datum(s,{name:'Valor A',type:'number'}),b=datum(s,{name:'Valor B',type:'number'});s.operate([{type:'insertNode',path:location,index:0,value:{type:'group',label:'Ofício',layout:{type:'grid'},components:[{type:'number',dataId:a.id,label:'Valor'}],extensions:{opaque:false}}}]);const plan=createComponentDefinitionPlan(s.validation.value,[...location,0],'Ofício comum');s.operate(plan.commands);ready(s.validation.value);const parameter=plan.definition.parameters[0];s.operate([{type:'insertNode',path:location,index:1,value:{type:'componentInstance',definitionId:plan.definition.id,bindings:{[parameter.id]:b.id}}}]);const p=s.validation.value,c=structuredClone(p.system.characterTemplate);writeData(p.system,c,a.id,{present:true,value:2});writeData(p.system,c,b.id,{present:true,value:9});let expanded=expandComponents(p.layouts[0].tabs[0].sections[0].containers[0],p.system,c);assert.equal(expanded[0].field,a.binding);assert.equal(expanded[1].field,b.binding);
 s.operate([{type:'setProperty',path:['system','componentDefinitions',0,'components',0,'label'],value:'Compartilhado'}]);assert.equal(expandComponents(s.validation.value.layouts[0].tabs[0].sections[0].containers[0],s.validation.value.system,c)[1].label,'Compartilhado');s.operate(detachComponentPlan(s.validation.value,[...location,0]).commands);assert.equal(components(s.validation.value)[0].type,'group');assert.deepEqual(components(s.validation.value)[0].extensions,{opaque:false});s.operate(copyComponentDefinitionPlan(s.validation.value,plan.definition.id).commands);assert.notEqual(s.validation.value.system.componentDefinitions[1].id,plan.definition.id);ready(s.validation.value);s.replay('undo');s.replay('redo');ready(s.validation.value);
});

test('AV-02 ciclos, profundidade e movimento para descendente são recusados',()=>{
 const p=minimalPackage('cycle');p.system.componentDefinitions=[{id:'local',label:'Ciclo',revision:1,parameters:[],components:[{type:'componentInstance',definitionId:'local',bindings:{}}]}];assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');assert.throws(()=>expandComponents({components:[{type:'componentInstance',definitionId:'local',bindings:{}}]},p.system),/Ciclo/);
 const q=minimalPackage('depth');let group={type:'group',label:'Topo',components:[]};components(q).push(group);for(let i=0;i<9;i++){const next={type:'group',components:[]};group.components.push(next);group=next;}assert.equal(prepareDocument(q,{kind:'package'}).status,'invalid');
 const r=minimalPackage('move');components(r).push({type:'group',label:'Topo',components:[{type:'group',label:'Filho',components:[]}]});const parent=structuralNodes(r).find(n=>n.title==='Topo'),target=destinations(r,'component').find(d=>d.title.startsWith('Filho'));assert.throws(()=>structureCommand(r,parent,'move',{destination:target.path,to:0}),/descendente/);
});

test('AV-02 regras de campo/entrada e extras sobrevivem roundtrip sem iniciais na abertura',()=>{
 const s=session(),record=datum(s,{name:'Contexto',type:'record'});field(s,record,{name:'Nota',type:'string',hasInitial:true,initial:'nova'});const p=s.validation.value,text=JSON.stringify(p),opened=new EditorSession({text});assert.equal(opened.text,text);assert.equal(Object.hasOwn(p.system.characterTemplate,record.binding),false);const imported=prepareDocument(JSON.parse(text),{kind:'package'});assert.equal(imported.status,'ready');assert.deepEqual(imported.document,p);
 const bad=structuredClone(p);bad.system.dataDefinitions[0].fields[0].id=record.id;assert.equal(prepareDocument(bad,{kind:'package'}).status,'invalid');
});

test('AV-02 prévia registra filhos de grupos e ocorrência preserva origem/identidade',()=>{
 const s=session(),collection=datum(s,{name:'Linhas',type:'collection',hasInitial:true,initial:[]}),value=field(s,collection,{name:'Valor',type:'number'});const p=s.validation.value;
 components(p).push({type:'group',label:'Linhas',repeat:{scope:'character',dataId:collection.id},components:[{type:'number',dataId:value.id,label:'Número'}]});
 const c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeData(p.system,c,collection.id,{present:true,value:[{id:'a',[value.binding]:0},{id:'b',[value.binding]:2}]});
 const pointer='/layouts/0/tabs/0/sections/0/containers/0/components/0/components/0';assert.ok(previewSources(p,'default').has(pointer));const expanded=expandComponents(p.layouts[0].tabs[0].sections[0].containers[0],p.system,c);
 assert.deepEqual(expanded.map(row=>row.groupTrail[0].occurrence.map(e=>e.entryId)),[['a'],['b']]);assert.deepEqual(expanded[0].sourcePath,expanded[1].sourcePath);assert.equal(components(p).length,1);
});

test('AV-02 edição vinculada verifica unicidade e referência antes de qualquer escrita',()=>{
 const s=session(),collection=datum(s,{name:'Ofícios',type:'collection',hasInitial:true,initial:[]}),name=field(s,collection,{name:'Nome',type:'string'});s.operate([{type:'setProperty',path:['system','dataDefinitions',0,'unique'],value:[name.id]}]);const reference=datum(s,{name:'Escolha',type:'reference',multiple:false,target:{scope:'character',dataId:collection.id}}),p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));
 writeValidatedData(p.system,c,collection.id,{present:true,value:[{id:'a',[name.binding]:'A'},{id:'b',[name.binding]:'B'}]});writeValidatedData(p.system,c,reference.id,{present:true,value:'a'});const before=structuredClone(c);
 assert.throws(()=>writeValidatedData(p.system,c,name.id,{present:true,value:'B'},{entries:[{dataId:collection.id,entryId:'a'}]}),/duplicado/);assert.deepEqual(c,before);
 assert.throws(()=>writeValidatedData(p.system,c,collection.id,{present:true,value:[c[collection.binding][1]]}),/referência/);assert.deepEqual(c,before);
 assert.throws(()=>writeValidatedData(p.system,c,reference.id,{present:true,value:'missing'}),/referência/);assert.deepEqual(c,before);
});

test('AV-02 composto/desvincular conserva repeat, notas, variantes, ajuda, papel e extras',()=>{
 const s=session(),collection=datum(s,{name:'Ofícios',type:'collection',hasInitial:true,initial:[]}),value=field(s,collection,{name:'Valor',type:'number'});
 const group={type:'group',label:'Módulo',repeat:{scope:'character',dataId:collection.id},note:'Nota',help:'Ajuda',variant:'soft',print:{compact:{include:false}},extensions:{private:false},layout:{type:'grid',gap:8},components:[{type:'number',dataId:value.id,label:'Número'}]};s.operate([{type:'insertNode',path:location,index:0,value:group}]);s.operate(createComponentDefinitionPlan(s.validation.value,[...location,0],'Comum').commands);ready(s.validation.value);
 const p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeData(p.system,c,collection.id,{present:true,value:[{id:'a',[value.binding]:2}]});const container=p.layouts[0].tabs[0].sections[0].containers[0];assert.equal(expandComponents(container,p.system,c)[0].groupTrail[0].note,'Nota');assert.equal(componentsForPrint(container,p.system,'compact',c).length,0);
 s.operate(detachComponentPlan(p,[...location,0]).commands);assert.deepEqual(components(s.validation.value)[0],group);ready(s.validation.value);
});

test('AV-02 busca/papel usam rótulos tipados e não números de ID nem JSON bruto',()=>{
 const s=session(),choice=datum(s,{name:'Categoria',type:'enum',options:[{id:'red',label:'Rubi'}],hasInitial:true,initial:'red'}),trait=datum(s,{name:'Traço',type:'trait',scale:[4,6,8],composite:true,hasInitial:true,initial:[6,4]}),p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));
 assert.equal(typedComponentValue({system:p.system,character:c,dataId:choice.id}),'Rubi');assert.equal(typedComponentValue({system:p.system,character:c,dataId:trait.id}),'d6 + d4');
 components(p).push({type:'dataField',dataId:choice.id,label:'Categoria'});assert.equal(buildSearchIndex(p.layouts[0],c,p.system)[0].value,'Rubi');
});

test('AV-02 catálogos sem dataDefinitions ainda são validados, chaves e IDs não colidem',()=>{
 const p=minimalPackage('catalog');delete p.system.dataDefinitions;p.system.catalogs=[{id:'catalog',label:'Catálogo',fields:[],entries:[{id:'repeated'},{id:'repeated'}]}];assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');
 const s=session(),collection=datum(s,{name:'Lista',type:'collection'}),identity=field(s,collection,{name:'ID',type:'string'});assert.notEqual(identity.binding,'id');ready(s.validation.value);
 const q=s.validation.value;q.system.catalogs=[{id:'catalog',label:'Catálogo',fields:[{...identity,id:'x'},{...identity,id:'y'}],entries:[]}];assert.equal(prepareDocument(q,{kind:'package'}).status,'invalid');
});

test('AV-02 referências conhecidas incluem portas/bindings e catálogo, sem tocar extras',()=>{
 const p=minimalPackage('references');p.layouts[0].tabs[0].sections[0].containers[0].components.push({type:'componentInstance',definitionId:'definition',bindings:{port:'data'},extensions:{dataId:'opaque'}});p.system.dataDefinitions.push({id:'ref',type:'reference',target:{scope:'system',catalogId:'catalog'}});p.system.componentDefinitions=[{id:'definition',parameters:[],components:[{type:'dataField',dataParameter:'port'}]}];
 const refs=knownReferences(p);assert.ok(refs.some(r=>r.parameterId==='port'&&r.value==='data'));assert.ok(refs.some(r=>r.kind==='catalogId'&&r.value==='catalog'));assert.ok(refs.some(r=>r.kind==='dataParameter'&&r.value==='port'));assert.ok(!refs.some(r=>r.value==='opaque'));
});

test('AV-02 leitura tipada de referência/registro/coleção preserva rótulos e contexto da entrada',()=>{
 const s=session(),list=datum(s,{name:'Rotas',type:'collection',hasInitial:true,initial:[]}),name=field(s,list,{name:'Nome',type:'string'}),active=field(s,list,{name:'Ativa',type:'boolean'}),chosen=datum(s,{name:'Escolhas',type:'reference',target:{scope:'character',dataId:list.id},multiple:true});const p=s.validation.value,c=initializeData(p.system,structuredClone(p.system.characterTemplate));writeValidatedData(p.system,c,list.id,{present:true,value:[{id:'a',[name.binding]:'Sul',[active.binding]:false},{id:'b',[name.binding]:'Norte',[active.binding]:true}]});writeValidatedData(p.system,c,chosen.id,{present:true,value:['b','a']});assert.equal(typedComponentValue({system:p.system,character:c,dataId:chosen.id}),'Norte · Sul');
 const rows=typedSearchRecords({system:p.system,character:c,dataId:list.id,label:'Viagens'});assert.equal(rows.find(r=>r.label==='Viagens · Sul · Ativa').value,'Não');assert.deepEqual(rows.find(r=>r.label==='Viagens · Norte · Nome').entryIds,[{dataId:list.id,entryId:'b'}]);assert.ok(rows[0].value.includes('Nome: Sul'));assert.ok(rows[0].value.includes('Ativa: Sim'));
 for(const [cell,expected]of [[{present:false},'Ausente'],[{present:true,value:null},'null explícito'],[{present:true,value:''},'Texto vazio']])assert.equal(formatTypedCell(p.system,c,{type:'string'},cell),expected);
 assert.equal(formatTypedCell(p.system,c,{type:'collection',fields:[]},{present:true,value:[]}),'Nenhum registro');assert.equal(formatTypedCell(p.system,c,{type:'record',fields:[]},{present:true,value:{}}),'Registro vazio');
});

test('AV-02 iniciais com referências órfãs são recusadas sem materializar o template',()=>{
 const s=session(),catalog=createCatalogPlan(s.validation.value,'Rotas');s.operate(catalog.commands);const plan=createTypedDataPlan(s.validation.value,{name:'Rota',type:'reference',target:{scope:'system',catalogId:catalog.catalog.id},multiple:false,hasInitial:true,initial:'missing'}),p=JSON.parse(s.text);p.system.dataDefinitions.push(plan.definition);const before=structuredClone(p);assert.equal(prepareDocument(p,{kind:'package'}).status,'invalid');assert.deepEqual(p,before);
 const list=datum(s,{name:'Lista',type:'collection',hasInitial:true,initial:[]}),nested=field(s,list,{name:'Meta',type:'string'});assert.equal(nested.binding,'meta');ready(s.validation.value);
});

test('AV-02 limites de composição, tipos e unicidade são recusados antes de qualquer execução',()=>{
 const p=minimalPackage('limits');const container=p.layouts[0].tabs[0].sections[0].containers[0];container.components=Array.from({length:10001},()=>({type:'information',text:'Seguro'}));assert.throws(()=>expandComponents(container,p.system),/10000/);
 const collection={type:'collection',fields:[{id:'v',label:'Registro',type:'record',binding:'value',fields:[]}],unique:['v']};assert.match(typedValueIssue(collection,[{id:'a',value:{b:2,a:1}},{id:'b',value:{a:1,b:2}}]),/duplicado/);
 assert.match(typedValueIssue({type:'trait',scale:[4,6],composite:false},[4,6]),/traço/);assert.match(typedValueIssue({type:'reference',multiple:true},['a','a']),/únicas/);assert.match(typedValueIssue({type:'collection',fields:[],minItems:1},[]),/cardinalidade/);
 const q=minimalPackage('layout');q.system.componentDefinitions=[{id:'x',label:'Comum',revision:1,parameters:[],layout:{type:'absolute'},components:[]}];assert.equal(prepareDocument(q,{kind:'package'}).status,'invalid');
});
