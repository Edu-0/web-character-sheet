import {performance} from 'node:perf_hooks';
import {cpus,totalmem,release} from 'node:os';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {minimalPackage} from '../js/editor/minimal-package.js';
import {planDataMigration} from '../js/migrations/data-migration-plan.js';
import {compileRules,createRuleContext} from '../js/engine/rule-registry.js';
const report={environment:{node:process.version,cpu:cpus()[0]?.model,logicalProcessors:cpus().length,ramGiB:totalmem()/1024**3,os:release()},migration:[],rules:[]};
const summarize=samples=>{const sorted=[...samples].sort((a,b)=>a-b);return {samples,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],worst:sorted.at(-1)}};
for(const count of [100,1000,10000]){
 const base=minimalPackage('measure-migration');base.system.dataDefinitions=[{id:'value',label:'Valor',type:'integer',binding:'value',required:false,nullable:false}];const candidate=structuredClone(base);candidate.system.dataRevision=2;candidate.system.dataDefinitions[0].binding='renamed';const characters=Array.from({length:count},(_,i)=>({schemaVersion:1,meta:{id:'hero-'+i,system:base.system.id},value:i,extra:false})),spec={version:1,steps:[{targetId:'value',sourceIds:['value'],conversion:'copy',preserveSource:false}],retired:[]};
 const samples=[];for(let i=0;i<5;i++){const start=performance.now(),plan=planDataMigration({base,candidate,characters,spec});samples.push(performance.now()-start);assert.equal(plan.status,'ready');assert.equal(plan.characters.length,count);assert.equal(plan.characters.at(-1).after.renamed,count-1);assert.equal(characters[0].value,0);}report.migration.push({characters:count,inputBytes:Buffer.byteLength(JSON.stringify({base,candidate,characters,spec})),milliseconds:summarize(samples)});
}
for(const count of [100,1000]){
 const system=minimalPackage('measure-rules').system;system.rules=Array.from({length:count},(_,i)=>({id:'r'+i,label:'Regra '+i,revision:1,kind:'calculation',resultType:'number',expression:{id:'literal'+i,op:'literal',version:1,value:i}}));const samples=[],evaluation=[],cached=[],invalidation=[];let rejected;
 for(let i=0;i<10;i++){const start=performance.now();try{compileRules(system);}catch(error){rejected=error.message;}samples.push(performance.now()-start);if(rejected)continue;const character={schemaVersion:3,meta:{system:system.id}},begin=performance.now(),context=createRuleContext(system,character);for(const rule of system.rules)context.evaluate(rule.id);evaluation.push(performance.now()-begin);const again=performance.now();for(const rule of system.rules)context.evaluate(rule.id);cached.push(performance.now()-again);const invalid=performance.now();context.invalidate();for(const rule of system.rules)context.evaluate(rule.id);invalidation.push(performance.now()-invalid);}
 report.rules.push({rules:count,compileMilliseconds:summarize(samples),...(rejected?{rejected}:{evaluationMilliseconds:summarize(evaluation),cachedMilliseconds:summarize(cached),invalidationMilliseconds:summarize(invalidation)})});
}
await mkdir(new URL('../tmp/',import.meta.url),{recursive:true});
await writeFile(new URL('../tmp/authoring-measurements.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
