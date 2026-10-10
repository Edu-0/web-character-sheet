import {readData, dataDefinition} from './data-definitions.js';

// Distributed application code, never package callbacks. Version 1 is numeric only.
export const RULE_LIMITS = Object.freeze({rules:100, nodes:128, depth:16});
export const RULE_OPERATIONS = Object.freeze({
  literal:{label:'Número', inputs:[], evaluate:n => n.value},
  read:{label:'Ler dado', inputs:[]},
  ifAbsent:{label:'Usar se ausente', inputs:['value','fallback'], optional:true},
  add:{label:'Somar', inputs:['left','right'], evaluate:(_,a,b) => a+b},
  subtract:{label:'Subtrair', inputs:['left','right'], evaluate:(_,a,b) => a-b},
  multiply:{label:'Multiplicar', inputs:['left','right'], evaluate:(_,a,b) => a*b},
  divide:{label:'Dividir', inputs:['left','right'], evaluate:(_,a,b) => {if(b===0)throw new Error('Divisão por zero');return a/b;}},
  floor:{label:'Arredondar para baixo', inputs:['value'], evaluate:(_,a) => Math.floor(a)},
});
export function evaluateRule(system, character, id) {
  if (system?.schemaVersion !== 3) throw new Error('Regras declarativas exigem v3.');
  const rule = system.rules?.find(r => r.id === id);
  if (!rule || rule.kind !== 'calculation' || rule.resultType !== 'number' || !Number.isSafeInteger(rule.revision) || rule.revision < 1) throw new Error(`Cálculo indisponível: ${id}`);
  let count=0;
  const visit=(node,depth=0)=>{
    if (++count>RULE_LIMITS.nodes || depth>RULE_LIMITS.depth) throw new Error('Limite de cálculo excedido');
    const operation=Object.hasOwn(RULE_OPERATIONS,node?.op)?RULE_OPERATIONS[node.op]:null;
    if (!operation || node.version !== 1) throw new Error('Operação ou versão indisponível');
    if (node.op==='read') {
      const definition=dataDefinition(system,node.dataId);
      if (!['number','integer'].includes(definition.type)) throw new Error('Fonte deve ser numérica');
      return {...readData(system,character,node.dataId),source:definition.label};
    }
    if (node.op==='ifAbsent') {
      const cell=visit(node.value,depth+1);
      return cell.present ? cell : visit(node.fallback,depth+1);
    }
    const args=operation.inputs.map(key=>visit(node[key],depth+1));
    for (const cell of args) if (!cell.present || typeof cell.value!=='number' || !Number.isFinite(cell.value)) throw new Error('Fonte ausente, nula ou não numérica'+(cell.source?' ('+cell.source+')':''));
    const value=operation.evaluate(node,...args.map(c=>c.value));
    if(typeof value!=='number' || !Number.isFinite(value)) throw new Error('Resultado não finito');
    return {present:true,value};
  };
  const cell=visit(rule.expression);
  if(!cell.present || typeof cell.value!=='number' || !Number.isFinite(cell.value)) throw new Error('Resultado ausente, nulo ou não numérico'+(cell.source?' ('+cell.source+')':''));
  return cell.value;
}
