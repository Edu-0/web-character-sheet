// Descriptors drive real UI controls when integrated; not injected documents.
import {resolutionPortId} from '../../js/engine/resolution-results.js';
const n=value=>({op:'literal',value}),local=id=>({op:'local',localId:id}),item=()=>({op:'item'}),read=dataId=>({op:'read',dataId}),bin=(op,left,right)=>({op,left,right}),identity=value=>({op:'entryIdentity',value}),count=source=>({op:'count',source}),positive=source=>bin('greater',count(source),n(0));
export async function poolSteps({resolve,manualFlag,manualValue,produce,choose}){
 const p=(name,value)=>({op:'property',fieldId:resolutionPortId(resolve,name),value}),all=()=>p('groups',local(resolve)),size=value=>({op:'max',source:{op:'map',source:p('groups_dice',value),value:p('groups_dice_sides',item())}});
 const correction=await choose('Fonte com resultado informado',all(),resolutionPortId(resolve,'groups_label'),{when:read(manualFlag),otherwise:{op:'first',source:all()}});
 const score=value=>({op:'if',condition:bin('and',read(manualFlag),bin('equal',identity(value),identity(local(correction)))),then:read(manualValue),else:p('groups_total',value)}),totals=source=>({op:'map',source,value:score(item())});
 const highest=await produce('Maior resultado', 'number',{op:'max',source:totals(all())});
 const highCandidates=await produce('Fontes com maior resultado','collection',{op:'filter',source:all(),predicate:bin('equal',score(item()),local(highest))});
 const highSize=await produce('Maior componente no empate','number',{op:'max',source:{op:'map',source:local(highCandidates),value:size(item())}});
 const apex=await produce('Fonte do cume','record',{op:'first',source:{op:'filter',source:local(highCandidates),predicate:bin('equal',size(item()),local(highSize))}});
 const afterApex=await produce('Fontes após cume','collection',{op:'filter',source:all(),predicate:{op:'not',value:bin('equal',identity(item()),identity(local(apex)))}});
 const lowest=await produce('Menor resultado restante','number',{op:'if',condition:positive(local(afterApex)),then:{op:'min',source:totals(local(afterApex))},else:score(local(apex))});
 const lowCandidates=await produce('Fontes com menor resultado','collection',{op:'filter',source:local(afterApex),predicate:bin('equal',score(item()),local(lowest))});
 const lowSize=await produce('Componente no empate da base','number',{op:'if',condition:positive(local(lowCandidates)),then:{op:'max',source:{op:'map',source:local(lowCandidates),value:size(item())}},else:n(0)});
 const base=await produce('Fonte da base','record',{op:'if',condition:positive(local(lowCandidates)),then:{op:'first',source:{op:'filter',source:local(lowCandidates),predicate:bin('equal',size(item()),local(lowSize))}},else:local(apex)});
 const remaining=await produce('Fontes disponíveis para potência','collection',{op:'filter',source:all(),predicate:bin('and',{op:'not',value:bin('equal',identity(item()),identity(local(apex)))},{op:'not',value:bin('equal',identity(item()),identity(local(base)))})});
 const power=await choose('Fonte de potência',local(remaining),resolutionPortId(resolve,'groups_label'),{when:positive(local(remaining)),otherwise:local(apex)});
 const weight=await produce('Peso sem duplicar fonte única','number',bin('add',score(local(apex)),{op:'if',condition:bin('equal',identity(local(apex)),identity(local(base))),then:n(0),else:score(local(base))}));
 const potency=await produce('Potência pelo tamanho escolhido','number',{op:'if',condition:positive(local(remaining)),then:size(local(power)),else:n(4)});
 const rest=await produce('Soma dos tamanhos restantes','number',{op:'sum',source:{op:'map',source:local(remaining),value:size(item())}});
 return {highest,lowest,apex,base,remaining,weight,potency,rest};
}
