import {RESOLUTION_LIMITS} from './roll-transcript.js';

// These ports describe an existing transcript. They never roll or write a field.
export function resolutionPortId(stepId,name){
 const legacy=['total','success','rolled','outcome','result'].includes(name),full=legacy?stepId+'_'+name:'port_'+stepId.length+'_'+stepId+'_'+name;if(full.length<=100)return full;
 // Bounded deterministic IDs for long declarations; not a security/RNG hash.
 let a=2166136261,b=5381;for(const char of full){a=Math.imul(a^char.charCodeAt(0),16777619);b=Math.imul(b,33)^char.charCodeAt(0);}
 return 'result_'+(a>>>0).toString(16)+'_'+(b>>>0).toString(16)+'_'+name;
}
export function resolutionResultDefinition(step){
 const field=(name,binding,label,type,required=true,extra={})=>({id:resolutionPortId(step.id,name),label,binding,type,required,nullable:false,...extra});
 const numbers=(name,binding,label)=>field(name,binding,label,'collection',true,{maxItems:RESOLUTION_LIMITS.draws,fields:[field(name+'_value','value','Valor','integer')]});
 const dice=field('groups_dice','dice','Dados deste grupo','collection',true,{maxItems:RESOLUTION_LIMITS.draws,fields:[
  field('groups_dice_index','index','Posição do dado','integer'),field('groups_dice_sides','sides','Tamanho do dado','integer'),
  field('groups_dice_original','original','Face original','integer'),field('groups_dice_value','value','Resultado usado','integer'),
  field('groups_dice_kept','kept','Dado mantido','boolean'),numbers('groups_dice_rerolls','rerolls','Faces de rerrolagem'),numbers('groups_dice_explosions','explosions','Faces de explosão'),
 ]});
 const groups=field('groups','groups','Grupos da resolução','collection',true,{maxItems:RESOLUTION_LIMITS.groups,fields:[
  field('groups_label','label','Nome do grupo','string'),field('groups_type','type','Primitiva do grupo','string'),
  field('groups_total','total','Total desta fonte','number'),dice,field('groups_units','units','Unidade compartilhada','integer',false),
  numbers('groups_tens','tens','Dezenas compartilhadas'),numbers('groups_candidates','candidates','Candidatos percentuais'),
 ]});
 return {id:resolutionPortId(step.id,'result'),label:step.label||step.id,type:'record',required:true,nullable:false,fields:[
  field('total','total','Total da resolução','number'),field('success','success','Sucesso da resolução','boolean',Boolean(step.success||step.otherwise)),
  field('rolled','rolled','Houve lançamento','boolean'),field('outcome','outcome','Faixa do resultado','string'),groups,
 ]};
}
const numberRows=values=>(values||[]).map((value,index)=>({id:'face-'+index,value}));
export function resolutionResultValue(summary,groups=[]){
 return {...summary,groups:groups.map(group=>({id:group.id,label:group.label,type:group.type,total:group.total,
  dice:(group.dice||[]).map(die=>({id:'die-'+die.index,index:die.index,sides:die.sides,original:die.original,value:die.value,kept:die.kept,rerolls:numberRows(die.rerolls),explosions:numberRows(die.explosions)})),
  ...(group.units!==undefined?{units:group.units}:{}),tens:numberRows(group.tens),candidates:numberRows(group.candidates),
 }))};
}
