import {test} from 'node:test';
import assert from 'node:assert/strict';
import {convertDataCells,validateConversion} from '../../js/migrations/data-conversions.js';
const cell=value=>({present:true,value}),convert=(kind,value,options)=>convertDataCells(kind,[cell(value)],options);

test('AV-11 conversões explícitas distinguem ausência/null/vazio/zero/false e não mutam fontes',()=>{
 for(const value of [null,'',0,false,{extra:null},[0,false]]){const before=structuredClone(value);assert.deepEqual(convert('copy',value),cell(value));assert.deepEqual(value,before);}
 for(const kind of ['copy','text','number','integer','boolean'])assert.deepEqual(convertDataCells(kind,[{present:false}]),{present:false});
 for(const value of [null,'',false,[],{},'12x',' 12 '])assert.throws(()=>convert('number',value));
 assert.deepEqual(convert('number','0'),cell(0));assert.deepEqual(convert('number','-1.25e2'),cell(-125));assert.deepEqual(convert('text',false),cell('false'));
});
test('AV-11 números, arredondamento e booleanos exigem política explícita e valores seguros',()=>{
 assert.throws(()=>convert('integer',1.5),/arredondamento/);for(const [rounding,value]of [['floor',-2],['ceil',-1],['round',-1],['truncate',-1]])assert.deepEqual(convert('integer',-1.5,{rounding}),cell(value));
 for(const value of [Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>convert('integer',value));
 assert.deepEqual(convert('boolean','Sim',{trueValue:'Sim',falseValue:'Não'}),cell(true));assert.deepEqual(convert('boolean','Não',{trueValue:'Sim',falseValue:'Não'}),cell(false));assert.deepEqual(convert('boolean',false),cell(false));for(const value of [0,1,null,''])assert.throws(()=>convert('boolean',value));
});
test('AV-11 mapas preservam identidades por escolhas declaradas sem deduzir rótulos',()=>{
 const options={pairs:[{from:'old',to:'new'},{from:null,to:null},{from:'',to:'empty'}]};assert.deepEqual(convert('map','old',options),cell('new'));assert.deepEqual(convert('map',null,options),cell(null));assert.deepEqual(convert('map','',options),cell('empty'));
 assert.throws(()=>convert('map','unknown',options),/correspondência/);assert.deepEqual(convert('map','unknown',{...options,unmapped:'keep'}),cell('unknown'));assert.deepEqual(convert('map',['old','old'],{...options,each:true}),cell(['new','new']));
 assert.throws(()=>validateConversion('map',{pairs:[{from:0,to:1},{from:0,to:2}]}),/duplicada/);assert.deepEqual(options.pairs[0],{from:'old',to:'new'});
});
test('AV-11 dividir/juntar texto conserva vazios e recusa fontes ausentes, null e parâmetros executáveis',()=>{
 assert.deepEqual(convert('split','|nome|',{separator:'|',index:0}),cell(''));assert.deepEqual(convert('split','|nome|',{separator:'|',index:1}),cell('nome'));assert.deepEqual(convertDataCells('join',[cell(''),cell('nome'),cell('')],{separator:'|'}),cell('|nome|'));
 assert.throws(()=>convert('split','one',{separator:'|',index:1}));assert.throws(()=>convertDataCells('join',[{present:false},cell('')],{separator:''}));assert.throws(()=>convertDataCells('join',[cell(null),cell('')],{separator:''}));
 for(const [kind,options]of [['eval',{}],['copy',{script:'return value'}],['integer',{rounding:'parseInt'}],['boolean',{trueValue:'x',falseValue:'x'}],['split',{separator:'',index:0}]])assert.throws(()=>validateConversion(kind,options));
});
