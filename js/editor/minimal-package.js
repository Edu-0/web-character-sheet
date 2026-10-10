export function minimalPackage(id = `pacote-${crypto.randomUUID().slice(0,8)}`, name = 'Novo sistema') {
  return {kind:'rpg-system-package',schemaVersion:3,
    system:{schemaVersion:3,id,name,characterTemplate:{schemaVersion:1,meta:{system:id}},dataDefinitions:[],rules:[]},
    layouts:[{schemaVersion:3,id:'default',system:id,tabs:[{id:'main',label:'Ficha',sections:[{id:'basic',title:'Personagem',containers:[{layout:{type:'stack'},components:[]}]}]}]}]};
}
