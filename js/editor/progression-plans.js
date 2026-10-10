import {destinations,valueAt} from './form-structure.js';
import {generatedKey} from './data-index.js';
import {setValueCommands} from './form-commands.js';
import {pointerFor} from './source-map.js';
import {validateFormula} from '../engine/formula.js';

export function progressionRecipePlan(pkg,{type,name,destination,config}) {
 if(!String(name||'').trim())throw new Error('Informe o nome mostrado na ficha.');
 if(!destinations(pkg,'component').some(d=>pointerFor(d.path)===pointerFor(destination)))throw new Error('Escolha um grupo válido.');
 const draft=structuredClone(pkg),commands=[],dependencies=[],components=[],scale=pkg.system.dieScale||config.scale;
 if(!Array.isArray(scale)||!scale.length)throw new Error('Configure primeiro a escala de dados do sistema.');
 if(!pkg.system.dieScale){commands.push(...setValueCommands(pkg,['system','dieScale'],scale));dependencies.push('Escala de dados: '+scale.join(', '));}
 const create=(scope,label,value)=>{const parent=scope==='character'?draft.system.characterTemplate:draft.system,key=generatedKey(label,Object.keys(parent));parent[key]=structuredClone(value);commands.push(...setValueCommands(pkg,scope==='character'?['system','characterTemplate',key]:['system',key],value));dependencies.push((scope==='character'?'Dado: ':'Regra: ')+label);return key;};
 const collection=(label,schema)=>{const field=create('character',label,[]);components.push({type:'list',label,field,itemSchema:schema});return field;};
 const dieSchema={name:{type:'text',label:'Nome'},die:{type:'die',label:'Dado'}};
 let rule;
 if(type==='repertoire'){
  const specializationsField=config.specializationsField||collection(name+' especializações',dieSchema);
  const techniquesField=config.techniquesField||collection(name+' técnicas',{name:{type:'text',label:'Nome'},specializationId:{type:'reference',label:'Especialização',optionsFrom:'character.'+specializationsField,valueField:'id',labelField:'name'},maxDie:{type:'die',label:'Dado máximo'},learningSource:{type:'select',label:'Origem do aprendizado',options:[{value:'repertoire',label:'Repertório'},{value:'other',label:'Outra origem'}]}});
  if(!config.progression?.length)throw new Error('Acrescente ao menos um grau de repertório.');
  const progression={};for(const entry of config.progression){if(!scale.includes(entry.die)||Object.hasOwn(progression,entry.die)||!Number.isInteger(entry.freeCount)||entry.freeCount<0||entry.grants.some(g=>!scale.includes(g.sides)||!Number.isInteger(g.count)||g.count<0))throw new Error('Graus devem ser únicos, com dados da escala e quantidades não negativas.');progression[entry.die]={freeCount:entry.freeCount,grants:structuredClone(entry.grants)};}
  rule={specializationsField,gradeField:config.gradeField||'die',techniquesField,linkField:config.linkField||'specializationId',progressionFrom:create('system',name+' progressão',progression)};
  dependencies.push('Repertório é um mínimo, não um limite de aprendizado. maxDie e learningSource são campos consumidos por esta família.');
 } else if(type==='pointBudget'){
  if(!config.presets?.length)throw new Error('Acrescente uma qualidade com pontos explícitos.');
  const presets=config.presets.map((p,i)=>{if(!p.label?.trim()||!Number.isInteger(p.points)||p.points<0||p.maxDie!==undefined&&!scale.includes(p.maxDie))throw new Error('Nomeie qualidades, informe pontos não negativos e teto da escala.');return {...p,id:'qualidade_'+(i+1)};});
  const presetsFrom=create('system',name+' qualidades',presets),qualityField=create('character',name+' qualidade',presets[0].id);
  components.push({type:'select',label:'Qualidade de criação',field:qualityField,optionsFrom:presetsFrom});
  const sources=[];for(const source of config.sources||[]){if(!source.label?.trim()||!scale.includes(source.baseDie)&&source.baseDie!==0)throw new Error('Nomeie as fontes e escolha o dado base.');
   const field=source.field||collection(source.label,{...dieSchema,...(source.directCost?{creationCost:{type:'number',label:'Custo de criação'}}:{})});
   const costs=source.costs;for(const [i,to]of scale.entries()){const from=i?scale[i-1]:0,key=from+'->'+to;if(!Number.isFinite(costs?.[key])||costs[key]<0)throw new Error('Informe todos os custos entre passos; zero é permitido.');}
   sources.push({...structuredClone(source),field,kind:source.kind||'list',baseDie:source.baseDie,costsFrom:create('system',source.label+' custos',costs),...(source.directCost?{costField:source.costField||'creationCost'}:{}),...(source.kind==='map'?{}:{valueField:source.valueField||'die'})});
   delete sources.at(-1).costs;delete sources.at(-1).directCost;
  }
  if(!sources.length)throw new Error('Acrescente uma fonte de criação/evolução.');
  const modifiers=(config.modifiers||[]).map(m=>{if(!m.label?.trim()||![-1,1].includes(m.sign))throw new Error('Nomeie modificadores e escolha somar ou descontar.');return {field:m.field||collection(m.label,{name:{type:'text',label:'Nome'},points:{type:'number',label:'Pontos'}}),valueField:m.valueField||'points',sign:m.sign,label:m.label};});
  rule={field:create('character',name+' registro',{phase:'creation',history:[]}),qualityField,presetsFrom,adjustmentField:create('character',name+' ajuste',config.adjustment),evolutionField:create('character',name+' evolução recebida',config.awarded),sources,modifiers};
  if(!Number.isFinite(config.adjustment)||!Number.isFinite(config.awarded)||config.awarded<0)throw new Error('Informe ajuste e evolução recebida, sem inferir custos.');
  components.push({type:'number',label:'Ajuste de pontos',field:rule.adjustmentField},{type:'number',label:'Evolução recebida',field:rule.evolutionField});
  if(config.postAscension){validateFormula(config.postAscension);rule.postAscension={enabledField:create('character',name+' pós-ascensão',false),formulaFrom:create('system',name+' fórmula pós-ascensão',config.postAscension)};components.push({type:'boolean',label:'Usar custo pós-ascensão',field:rule.postAscension.enabledField});}
  dependencies.push('Criação, evolução paga e evolução narrativa têm registros separados; edição direta não cobra pontos.');
 } else throw new Error('Receita de progressão desconhecida.');
 const configFrom=create('system',name+' configuração',rule),index=valueAt(pkg,destination).length;
 for(const [i,component]of [{type,label:name,configFrom},...components].entries())commands.push({type:'insertNode',path:destination,index:index+i,value:component});
 return {commands,selection:[...destination,index],dependencies};
}
