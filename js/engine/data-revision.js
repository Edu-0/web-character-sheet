// Optional v3 binding revision. Legacy packages keep their metadata opaque.
export function systemDataRevision(system){
 if(system?.schemaVersion!==3||system.dataRevision===undefined)return 1;
 if(!Number.isSafeInteger(system.dataRevision)||system.dataRevision<1||system.dataRevision>1000000)throw Error('Revisão de dados exige inteiro entre 1 e 1000000.');return system.dataRevision;
}
export function initializeDataRevision(system,character){
 if(system?.schemaVersion===3&&system.dataRevision!==undefined){character.meta??={};character.meta.systemDataRevision=systemDataRevision(system);}return character;
}
export function dataRevisionIssues(system,character,{template=false}={}){
 if(system?.schemaVersion!==3||system.dataRevision===undefined)return [];
 const expected=systemDataRevision(system),actual=Object.hasOwn(character.meta??{},'systemDataRevision')?character.meta.systemDataRevision:1;
 if(!Number.isSafeInteger(actual)||actual<1||actual>1000000)return [{path:'character.meta.systemDataRevision',message:'Metadado de revisão de dados inválido; preserve o original.',code:'data.revision'}];
 if(!template&&actual!==expected)return [{path:'character.meta.systemDataRevision',message:`Personagem usa revisão de dados ${actual}; o pacote usa ${expected}. Migração explícita é necessária; abrir/importar não converte.`,code:'data.revision'}];return [];
}
