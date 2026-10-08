export function copyPackage(pkg,id=`${pkg.system.id}-copia-${crypto.randomUUID().slice(0,8)}`) {
  const copy=structuredClone(pkg);copy.system.id=id;copy.system.name=`${pkg.system.name} (cópia)`;
  copy.system.characterTemplate.meta.system=id;
  for(const layout of copy.layouts)layout.system=id;
  return copy;
}
