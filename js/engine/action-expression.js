import {compileRules,createRuleContext} from './rule-registry.js';
import {sameRuleType,typeOfDefinition} from './rule-analysis.js';

// A temporary expression is admitted and evaluated by the same pure registry.
// Inputs and previously produced locals are never added to character bindings.
export function compileActionExpression(system,expression,resultType,scope={}){
 compileRules(system);let ruleId='action_expression';while(system.rules?.some(r=>r.id===ruleId))ruleId+='_new';
 const rule={id:ruleId,label:scope.label||'Expressão da ação',revision:1,kind:'calculation',resultType:'infer',expression:structuredClone(expression),...(scope.context?{context:scope.context}:{})},evaluationSystem={...system,rules:[...(system.rules||[]),rule]},actionScope={ruleId,inputs:scope.inputs||[],locals:scope.locals||[]},compiled=compileRules(evaluationSystem,{actionScope});
 const record=compiled.index.get(ruleId),type=compiled.types.get(ruleId+':'+record.rule.expression.id);
 if(resultType&&type.type!==resultType&&!(resultType==='number'&&type.type==='integer')&&!(type.type==='null'&&scope.expectedDefinition?.nullable))throw Error('Resultado da ação exige '+resultType+', recebeu '+type.type+'.');
 if(scope.expectedDefinition&&!sameRuleType(type,typeOfDefinition(scope.expectedDefinition))&&!(type.type==='null'&&scope.expectedDefinition.nullable))throw Error('Tipo nominal do resultado incompatível com o destino da ação.');
 return {system:evaluationSystem,ruleId,actionScope,type,compiled};
}
export function evaluateActionExpression(system,character,expression,resultType,scope={},options={}){
 const compiled=compileActionExpression(system,expression,resultType,scope);return evaluateCompiledActionExpression(compiled,character,options);
}
export function evaluateCompiledActionExpression(compiled,character,options={}){
 const evaluation=createRuleContext(compiled.system,character,{...options,actionScope:compiled.actionScope}),value=evaluation.evaluate(compiled.ruleId,options.dataContext);for(const reading of evaluation.readings.values())options.onRead?.(reading);return value;
}
