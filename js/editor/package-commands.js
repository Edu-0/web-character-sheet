export function copyPackage(pkg,id=`${pkg.system.id}-copia-${crypto.randomUUID().slice(0,8)}`) {
  const copy=structuredClone(pkg);copy.system.id=id;copy.system.name=`${pkg.system.name} (cópia)`;
  copy.system.characterTemplate.meta.system=id;
  for(const layout of copy.layouts)layout.system=id;
  return copy;
}

// Opt-in only: preserve legacy formulas, fields, template and character version.
export function version3Plan(pkg) {
  if(![1,2].includes(pkg.schemaVersion) || ![1,2].includes(pkg.system?.schemaVersion))throw new Error('Escolha um pacote v1/v2 válido.');
  const commands=[{type:'setProperty',path:['schemaVersion'],value:3},{type:'setProperty',path:['system','schemaVersion'],value:3}];
  for(const [index]of pkg.layouts.entries())commands.push({type:'setProperty',path:['layouts',index,'schemaVersion'],value:3});
  for(const key of ['dataDefinitions','rules'])if(!Object.hasOwn(pkg.system,key))commands.push({type:'setProperty',path:['system',key],value:[]});
  return {commands};
}
