import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverWorkspace,workspaceMode,diagnosticDestination} from '../../js/editor/workspace-state.js';
test('workspace resumes valid authoring context without changing legacy mode or package',()=>{
 const ui={mode:'forms',formPending:{'/system/name':{raw:'Em preparação'}},workspace:{area:'rules',rulesPanel:'effects',panel:'properties'}},before=structuredClone(ui);
 assert.deepEqual(recoverWorkspace(ui,{kind:'file'}),{...ui.workspace,tool:'structure',dataPanel:'typed',technicalMode:'forms'});assert.deepEqual(ui,before);
 assert.equal(recoverWorkspace({}, {kind:'new'}).area,'overview');assert.equal(recoverWorkspace({}, {kind:'file'}).area,'sheet');assert.equal(recoverWorkspace({mode:'json'},{kind:'file'}).area,'code');assert.equal(recoverWorkspace(ui,{},false).area,'code');
});
test('workspace sanitizes presentation values and maps areas to existing editing modes',()=>{
 const r=recoverWorkspace({workspace:{area:'unknown',panel:'unknown',tool:'unknown',dataPanel:'unknown',rulesPanel:'unknown',technicalMode:'script'}},{kind:'new'});assert.equal(r.area,'overview');assert.equal(r.panel,'canvas');assert.equal(r.tool,'structure');assert.equal(r.dataPanel,'typed');assert.equal(r.rulesPanel,'calculations');assert.equal(r.technicalMode,'json');
 assert.equal(workspaceMode('sheet'),'visual');assert.equal(workspaceMode('data'),'visual');assert.equal(workspaceMode('rules'),'visual');assert.equal(workspaceMode('test'),'experiment');assert.equal(workspaceMode('code','forms'),'forms');assert.equal(workspaceMode('code','unsupported'),'json');
});
test('diagnostics route to the editing surface without inventing data identities',()=>{
 assert.deepEqual(diagnosticDestination('/layouts/0/tabs/0'),{area:'sheet',panel:'properties'});assert.deepEqual(diagnosticDestination('/system/dataDefinitions/0'),{area:'data',dataPanel:'properties'});assert.deepEqual(diagnosticDestination('/system/rules/0'),{area:'rules',rulesPanel:'legacy'});assert.deepEqual(diagnosticDestination(''),{area:'code'});
});
