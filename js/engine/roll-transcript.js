import {rollOne} from './dice-resolver.js';

// Only these distributed numeric primitives may consume randomness. A package
// supplies data, never an evaluator. The transcript is a disposable action plan
// until the common character transaction commits it.
export const RESOLUTION_LIMITS=Object.freeze({groups:32,draws:100,sides:100000});
export const RESOLUTION_OPERATIONS=Object.freeze({
 dice:{label:'Lançar grupo de dados',version:1},
 sharedPercentile:{label:'Percentil com unidade compartilhada',version:1},
 select:{label:'Manter ou descartar por ordem estável',version:1},
 reroll:{label:'Rerrolar com limite e política explícitos',version:1},
 explode:{label:'Explodir com limite explícito',version:1},
 successes:{label:'Contar dados que atendem à condição',version:1},
 ranges:{label:'Classificar por faixas declaradas',version:1},
});
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const integer=(v,min,max,label)=>{if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(label+': inteiro entre '+min+' e '+max+' exigido.');return v;};
const number=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error(label+': número finito exigido.');return v;};
const keys=(v,allowed,label)=>{if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))throw Error(label+': parâmetros indisponíveis.');};
export function compareRollValue(value,condition){
 switch(condition.comparison){case'equal':return value===condition.threshold;case'less':return value<condition.threshold;case'lessEqual':return value<=condition.threshold;case'greater':return value>condition.threshold;case'greaterEqual':return value>=condition.threshold;default:throw Error('Comparação de resolução indisponível.');}
}
function condition(value){keys(value,['comparison','threshold'],'Condição de face');if(!['equal','less','lessEqual','greater','greaterEqual'].includes(value.comparison))throw Error('Comparação de resolução indisponível.');number(value.threshold,'Limiar');}
export function validateResolution(config){
 keys(config,['version','groups','modifier','success','ranges'],'Resolução');if(config.version!==1)throw Error('Versão de resolução indisponível.');
 if(!Array.isArray(config.groups)||config.groups.length>RESOLUTION_LIMITS.groups)throw Error('Use até32 grupos de resolução.');const ids=new Set();let total=0;
 for(const group of config.groups){
  keys(group,['id','label','type','dice','bonus','select','reroll','explode','score'],'Grupo');if(!id(group.id)||ids.has(group.id))throw Error('Identidade de grupo inválida ou duplicada.');ids.add(group.id);if(group.label!==undefined&&typeof group.label!=='string')throw Error('Rótulo de grupo deve ser texto.');
  if(group.type==='sharedPercentile'){integer(group.bonus,-2,2,'Saldo de bônus/penalidade');if(['dice','select','reroll','explode','score'].some(k=>group[k]!==undefined))throw Error('Percentil compartilhado usa saldo e seleção próprios.');total+=2+Math.abs(group.bonus);continue;}
  if(group.type!=='dice'||!Array.isArray(group.dice)||!group.dice.length||group.dice.length>100)throw Error('Grupo de dados indisponível.');for(const sides of group.dice)integer(sides,1,RESOLUTION_LIMITS.sides,'Faces');total+=group.dice.length;
  if(group.select!==undefined){keys(group.select,['mode','order','count'],'Seleção');if(!['keep','drop'].includes(group.select.mode)||!['high','low'].includes(group.select.order))throw Error('Seleção indisponível.');integer(group.select.count,0,group.dice.length,'Quantidade selecionada');}
  if(group.reroll!==undefined){keys(group.reroll,['when','limit','mode','optional'],'Rerrolagem');condition(group.reroll.when);integer(group.reroll.limit,1,10,'Teto de rerrolagem');if(!['replace','sum'].includes(group.reroll.mode)||typeof group.reroll.optional!=='boolean')throw Error('Política de rerrolagem explícita exigida.');}
  if(group.explode!==undefined){keys(group.explode,['when','limit'],'Explosão');condition(group.explode.when);integer(group.explode.limit,1,99,'Teto de explosão');}
  if(group.score!==undefined){keys(group.score,['mode','when','weight'],'Pontuação');if(!['sum','successes'].includes(group.score.mode)||group.score.weight!==undefined&&!['result','sides'].includes(group.score.weight))throw Error('Pontuação indisponível.');if(group.score.mode==='successes')condition(group.score.when);else if(group.score.when!==undefined)throw Error('Soma não recebe condição de sucessos.');}
 }
 if(total>RESOLUTION_LIMITS.draws)throw Error('Orçamento global de100 lançamentos excedido.');if(config.modifier!==undefined)number(config.modifier,'Modificador');if(config.success!==undefined)condition(config.success);
 if(config.ranges!==undefined){if(!Array.isArray(config.ranges)||config.ranges.length>32)throw Error('Use até32 faixas.');const ranges=[...config.ranges].sort((a,b)=>a.min-b.min);for(const [i,range]of ranges.entries()){keys(range,['id','label','min','max'],'Faixa');if(!id(range.id)||typeof range.label!=='string')throw Error('Faixa nomeada exigida.');number(range.min,'Mínimo');number(range.max,'Máximo');if(range.min>range.max||i&&ranges[i-1].max>=range.min)throw Error('Faixas inclusivas sobrepostas ou invertidas.');}if(new Set(ranges.map(r=>r.id)).size!==ranges.length)throw Error('Identidade de faixa duplicada.');}
 return config;
}

export function resolveRollTranscript(config,{die=rollOne,actionId=crypto.randomUUID(),transcript,choices={},budget={remaining:100}}={}){
 validateResolution(config);const snapshot=structuredClone(config),record=transcript?structuredClone(transcript):{version:1,actionId,configuration:snapshot,draws:[],choices:{}};
 if(record.version!==1||record.actionId!==actionId||JSON.stringify(record.configuration)!==JSON.stringify(snapshot)||!Array.isArray(record.draws)||record.draws.length>100||!object(record.choices))throw Error('Transcript pertence a outra ação/configuração.');
 const draws=new Map(),used=new Set();for(const row of record.draws){keys(row,['id','sides','value'],'Lançamento registrado');if(typeof row.id!=='string'||draws.has(row.id))throw Error('Identidade de lançamento duplicada.');integer(row.sides,1,100000,'Faces registradas');integer(row.value,1,row.sides,'Face registrada');draws.set(row.id,row);}
 keys(choices,config.groups.map(g=>g.id),'Escolhas de rerrolagem');keys(record.choices,config.groups.map(g=>g.id),'Escolhas registradas');const selected=new Map();for(const group of config.groups){const selection=choices[group.id]??record.choices[group.id]??[];if(!Array.isArray(selection)||new Set(selection).size!==selection.length||selection.some(v=>!Number.isSafeInteger(v)||v<0||v>=(group.dice?.length||0)))throw Error('Escolha de dado inválida.');if(selection.length&&(!group.reroll?.optional||selection.length>group.reroll.limit))throw Error('Quantidade de escolhas excede teto da rerrolagem.');if(Object.hasOwn(record.choices,group.id)&&JSON.stringify(record.choices[group.id])!==JSON.stringify(selection))throw Error('Rerrolagem já escolhida não pode ser trocada.');if(selection.length)record.choices[group.id]=[...selection];selected.set(group.id,new Set(selection));}
 const draw=(id,sides)=>{if(!used.has(id)&&--budget.remaining<0)throw Error('Orçamento global de100 lançamentos excedido.');used.add(id);const saved=draws.get(id);if(saved){if(saved.sides!==sides)throw Error('Faces do transcript não correspondem à configuração.');return saved.value;}if(record.draws.length>=100)throw Error('Orçamento global de100 lançamentos excedido.');const value=die(sides);integer(value,1,sides,'Resultado do dado');const row={id,sides,value};record.draws.push(row);draws.set(id,row);return value;};
 try{
  const groups=config.groups.map(group=>{
   if(group.type==='sharedPercentile'){const units=draw(group.id+':units',10)-1,tens=Array.from({length:1+Math.abs(group.bonus)},(_,i)=>draw(group.id+':tens:'+i,10)-1),candidates=tens.map(v=>v===0&&units===0?100:v*10+units),total=group.bonus<0?Math.max(...candidates):Math.min(...candidates);return {id:group.id,label:group.label||group.id,type:group.type,units,tens,candidates,total};}
   let rerolled=0;const dice=group.dice.map((sides,index)=>{
    const key=group.id+':'+index,original=draw(key+':original',sides),rerolls=[],explosions=[];let last=original,value=original;
    if(group.reroll?.optional&&selected.get(group.id).has(index)&&!compareRollValue(original,group.reroll.when))throw Error('O dado escolhido não atende à condição de rerrolagem.');
    if(group.reroll)while(rerolled<group.reroll.limit&&compareRollValue(last,group.reroll.when)&&(!group.reroll.optional||selected.get(group.id).has(index))){last=draw(key+':reroll:'+rerolls.length,sides);rerolls.push(last);value=group.reroll.mode==='sum'?value+last:last;rerolled++;if(group.reroll.optional)break;}
    if(group.explode){while(compareRollValue(last,group.explode.when)){if(explosions.length>=group.explode.limit)throw Error('Teto de explosão excedido; resultado inteiro recusado.');last=draw(key+':explode:'+explosions.length,sides);explosions.push(last);value+=last;}}
    return {id:key,index,sides,original,rerolls,explosions,value,kept:true};
   });
   if(group.select){const ranked=[...dice].sort((a,b)=>(group.select.order==='high'?b.value-a.value:a.value-b.value)||a.index-b.index),chosen=new Set(ranked.slice(0,group.select.count).map(d=>d.id));for(const row of dice)row.kept=group.select.mode==='keep'?chosen.has(row.id):!chosen.has(row.id);}
   const kept=dice.filter(d=>d.kept),score=group.score??{mode:'sum'},total=score.mode==='successes'?kept.filter(d=>compareRollValue(d.value,score.when)).length:kept.reduce((sum,d)=>sum+(score.weight==='sides'?d.sides:d.value),0);
   return {id:group.id,label:group.label||group.id,type:group.type,dice,total};
  });
  if([...draws.keys()].some(id=>!used.has(id)))throw Error('Transcript contém lançamento fora do percurso atual.');const total=number(groups.reduce((sum,g)=>sum+g.total,config.modifier??0),'Resultado'),range=config.ranges?.find(r=>r.min<=total&&total<=r.max);
  return {groups,total,...(config.success?{success:compareRollValue(total,config.success)}:{}),...(range?{rangeId:range.id,rangeLabel:range.label}:{}),transcript:record};
 }catch(error){error.transcript=record;throw error;}
}
