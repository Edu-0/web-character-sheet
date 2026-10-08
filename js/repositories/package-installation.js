import {prepareDocument} from '../validation/documents.js';
import {validateCharacterForPackage,assertValid} from '../validation/schemas.js';
import {validateEffectRevisionChange} from '../validation/effects.js';
export function installationPlan({candidate,base,currentPackage,builtinIds=[],characters=[],unavailableLinked=false,unavailableUnidentified=false}) {
  const prepared=prepareDocument(candidate,{kind:'package'});assertValid(candidate,()=>prepared.diagnostics,'pacote');
  if(prepared.status!=='ready')throw new Error('Normalização precisa ser confirmada antes de instalar.');
  const pkg=prepared.document;
  if(builtinIds.includes(pkg.system.id))throw new Error(`O ID "${pkg.system.id}" pertence a um sistema embutido.`);
  if(JSON.stringify(base ?? null)!==JSON.stringify(currentPackage ?? null))throw new Error('O pacote instalado mudou desde a abertura/revisão. Reabra como cópia ou exporte o rascunho; não há mescla automática.');
  if(unavailableLinked)throw new Error('Há personagem indisponível vinculado ao sistema. Exporte/corrija o original antes de substituir o pacote.');
  if(currentPackage && unavailableUnidentified)throw new Error('Há personagem indisponível sem identificação de sistema. Preserve/corrija o original antes de substituir pacotes.');
  if(currentPackage && prepareDocument(currentPackage,{kind:'package'}).status!=='ready')throw new Error('O pacote instalado está indisponível ou em versão não suportada. Preserve o original e trabalhe em uma cópia com outro ID.');
  if(currentPackage)assertValid(pkg.system,next=>validateEffectRevisionChange(currentPackage.system,next),'revisão de efeitos');
  const warnings=[];
  for(const character of characters){const issues=validateCharacterForPackage(character,pkg);assertValid(character,()=>issues,`personagem ${character.meta.id}`);warnings.push(...issues.filter(issue=>issue.severity==='warning'));}
  return {package:pkg,base:structuredClone(base ?? null),replace:Boolean(currentPackage),linkedIds:characters.map(character=>character.meta.id),warnings,removedLayouts:(currentPackage?.layouts || []).filter(layout=>!pkg.layouts.some(next=>next.id===layout.id)).map(layout=>layout.id)};
}
