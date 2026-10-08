import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditorSession} from '../../js/editor/session.js';
import {minimalPackage} from '../../js/editor/minimal-package.js';
import {validateText} from '../../js/editor/validation.js';
import {parseSource,locateDiagnostic} from '../../js/editor/source-map.js';
import {EditorHistory} from '../../js/editor/history.js';
const fixture = () => {
  const pkg=minimalPackage('editor-test');
  pkg.extra={null:null,zero:0,false:false,empty:'',array:[{x:1},{x:2}], 'a/b~.c':'escaped'};
  return JSON.stringify(pkg,null,2);
};
test('editor mantém texto inválido, lastValid independente e resultados obsoletos',()=>{
  const session=new EditorSession({text:fixture()}); const original=structuredClone(session.lastValid);
  session.replaceText('{ invalid'); session.validate();
  assert.equal(session.text,'{ invalid'); assert.deepEqual(session.lastValid,original);
  assert.equal(session.acceptValidation(validateText(fixture()),0,fixture()),false);
  session.lastValid.package.extra.zero=99; assert.equal(JSON.parse(session.text.replace('{ invalid',fixture())).extra.zero,0);
  session.replay('undo'); assert.equal(session.text,fixture());
  session.replay('redo'); assert.equal(session.text,'{ invalid');
});
test('operações atômicas preservam bytes no undo e distinguem presença de null/false/0/vazio',()=>{
  const session=new EditorSession({text:fixture()});
  session.operate([{type:'setProperty',path:['extra','absent'],value:null,precondition:{exists:false}},{type:'removeProperty',path:['extra','null']}]);
  const extra=JSON.parse(session.text).extra;
  assert.ok(Object.hasOwn(extra,'absent')); assert.equal(extra.absent,null); assert.ok(!Object.hasOwn(extra,'null'));
  assert.equal(extra.false,false); assert.equal(extra.zero,0); assert.equal(extra.empty,'');
  session.replay('undo'); assert.equal(session.text,fixture());
  assert.throws(()=>session.operate([{type:'setProperty',path:['extra','zero'],value:3},{type:'removeNode',path:['extra','array'],index:9}]));
  assert.equal(session.text,fixture());
  assert.throws(()=>session.operate([{type:'setProperty',path:['extra','constructor'],value:3}]));
  assert.throws(()=>session.operate([],{expectedRevision:0}));
});
test('arrays: mover/duplicar/inserir/remover e redo abandonado',()=>{
  const session=new EditorSession({text:fixture()});
  session.operate([{type:'moveNode',path:['extra','array'],index:0,to:1},{type:'duplicateNode',path:['extra','array'],index:0,to:2},{type:'insertNode',path:['extra','array'],index:0,value:false},{type:'removeNode',path:['extra','array'],index:1}]);
  assert.deepEqual(JSON.parse(session.text).extra.array,[false,{x:1},{x:2}]);
  session.replay('undo'); session.replaceText('null'); assert.equal(session.history.redoStack.length,0);
});

test('valores não JSON e move para descendente recusados atomicamente',()=>{
  const session=new EditorSession({text:fixture()});
  for(const value of [{nested:undefined},[undefined],new Date(),NaN,Infinity,-0,Array(2),{nested:1n}]){
    assert.throws(()=>session.operate([{type:'setProperty',path:['extra','zero'],value}]));assert.equal(session.text,fixture());
  }
  session.operate([{type:'setProperty',path:['extra','array'],value:[{children:[]}]}]);const before=session.text;
  assert.throws(()=>session.operate([{type:'moveNode',path:['extra','array'],index:0,toPath:['extra','array',0,'children'],to:0}]));assert.equal(session.text,before);
});
test('tokens detectam duplicatas escapadas, precisão decimal e sintaxe sem converter bruto',()=>{
  for (const text of ['{"a":1,"\\u0061":2}','{"n":9007199254740993}','{"n":0.10000000000000001}','{"n":1e309}','{"n":1e-400}','{"n":-0}']) assert.equal(validateText(text).status,'invalid');
  for (const token of ['0.1','1e3','1.2300','9007199254740992','5e-324']) assert.equal(parseSource(token).diagnostics.length,0);
  for (const text of ['[1,]','01','true false','"a\n"','{"a" 1}']) assert.ok(parseSource(text).diagnostics.some(issue=>issue.code==='json.syntax'));
  const text='{"a/b~.c": {"escaped\\"": false}}', result=parseSource(text);
  assert.equal(text.slice(...Object.values(result.locations.get('/a~1b~0.c/escaped"'))),'false');
  assert.equal(locateDiagnostic(text,result.locations,{pointer:'/a~1b~0.c/escaped"'}).exact,true);
});
test('versão futura não substitui lastValid e normalização exige comando explícito',()=>{
  const session=new EditorSession({text:fixture()}); const pkg=JSON.parse(fixture()); pkg.schemaVersion=99;
  session.replaceText(JSON.stringify(pkg)); assert.equal(session.validate().status,'unsupported'); assert.equal(session.lastValid.revision,0);
  session.restoreValid(); assert.equal(session.validation.status,'ready'); session.replay('undo'); assert.equal(session.validation.status,'unsupported');
});

test('número decimal longo e coordenadas por linha preservam precisão/offsets',()=>{
  assert.equal(parseSource('1.'+'0'.repeat(100000)).diagnostics.length,0);
  const text='\n{\n  "a": 0,\n  "b": false\n}\n',parsed=parseSource(text);
  assert.equal(locateDiagnostic(text,parsed.locations,{pointer:'/b'}).line,4);
  assert.equal(locateDiagnostic(text,parsed.locations,{pointer:'/b'}).column,8);
  assert.equal(locateDiagnostic(text,parsed.locations,{pointer:'/a'}).line,3);
});
test('histórico agrupa digitação, encerra grupos e informa tetos sem truncar texto',()=>{
  const history=new EditorHistory({limit:2,bytes:1000}); history.record('a','b',{group:'input',now:0}); history.record('b','c',{group:'input',now:900}); assert.equal(history.undoStack.length,1);
  history.breakGroup(); history.record('c','d',{group:'input',now:910}); history.record('d','e'); assert.equal(history.undoStack.length,2); assert.equal(history.boundary,true);
  history.record('e','x'.repeat(1000)); assert.equal(history.undoStack.length,0); assert.equal(history.boundary,true);
});
test('limites de texto/profundidade não truncam documento; caminhos do sistema são localizáveis',()=>{
  const session=new EditorSession({text:fixture()}); const text=' '.repeat(4*1024**2+1); session.replaceText(text); assert.equal(session.validate().status,'invalid'); assert.equal(session.text,text); assert.ok(session.lastValid);
  assert.ok(parseSource('['.repeat(34)+'0'+']'.repeat(34)).diagnostics.length);
  const pkg=minimalPackage('editor-test'); pkg.system.name=''; const result=validateText(JSON.stringify(pkg,null,2));
  assert.ok(result.diagnostics.find(issue=>issue.pointer==='/system/name')?.location?.exact);
});
