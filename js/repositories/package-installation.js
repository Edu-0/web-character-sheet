import {prepareDocument} from '../validation/documents.js';
import {validateCharacterForPackage,assertValid} from '../validation/schemas.js';
import {validateEffectRevisionChange} from '../validation/effects.js';
import {dataMigrationImpact,planDataMigration} from '../migrations/data-migration-plan.js';
import {systemDataRevision} from '../engine/data-revision.js';
import {planDataRestoration} from '../migrations/data-migration-recovery.js';
export function installationPlan({candidate,base,currentPackage,builtinIds=[],characters=[],unavailableLinked=false,unavailableUnidentified=false,migration,restoration,allowBlockedMigration=false}) {
  const prepared=prepareDocument(candidate,{kind:'package'});assertValid(candidate,()=>prepared.diagnostics,'pacote');
  if(prepared.status!=='ready')throw new Error('Normalização precisa ser confirmada antes de instalar.');
  const pkg=prepared.document;
  if(builtinIds.includes(pkg.system.id))throw new Error(`O ID "${pkg.system.id}" pertence a um sistema embutido.`);
  if(JSON.stringify(base ?? null)!==JSON.stringify(currentPackage ?? null))throw new Error('O pacote instalado mudou desde a abertura/revisão. Reabra como cópia ou exporte o rascunho; não há mescla automática.');
  if(unavailableLinked)throw new Error('Há personagem indisponível vinculado ao sistema. Exporte/corrija o original antes de substituir o pacote.');
  if(currentPackage && unavailableUnidentified)throw new Error('Há personagem indisponível sem identificação de sistema. Preserve/corrija o original antes de substituir pacotes.');
  if(currentPackage && prepareDocument(currentPackage,{kind:'package'}).status!=='ready')throw new Error('O pacote instalado está indisponível ou em versão não suportada. Preserve o original e trabalhe em uma cópia com outro ID.');
  if(migration!==undefined && restoration!==undefined)throw new Error('Escolha migração ou restauração, nunca ambas.');
  const dataRestoration=restoration===undefined?null:planDataRestoration({record:restoration,currentPackage,characters});
  if(dataRestoration && JSON.stringify(dataRestoration.record.beforePackage)!==JSON.stringify(pkg))throw new Error('Candidato diverge do pacote original da restauração.');
  if(currentPackage && !dataRestoration)assertValid(pkg.system,next=>validateEffectRevisionChange(currentPackage.system,next),'revisão de efeitos');
  if(currentPackage && JSON.stringify(currentPackage.system)!==JSON.stringify(pkg.system) && characters.some(character=>character.actionRecords?.some(record=>record.phase!=='complete')))throw new Error('Há execução pendente vinculada a este sistema. Conclua ou retome com o pacote original antes de alterar suas regras/dados; layouts podem ser editados separadamente.');
  if(currentPackage && characters.length && currentPackage.system.schemaVersion===3 && migration===undefined && !dataRestoration && dataMigrationImpact(currentPackage,pkg).some(row=>row.kind!=='added'))throw new Error('Mudança estrutural de dado instalado exige migração explícita. Preserve a definição ou trabalhe em cópia com outro ID.');
  if(migration!==undefined && !currentPackage)throw new Error('Migração exige um pacote anterior instalado.');
  if(migration!==undefined && (pkg.system.schemaVersion!==3 || pkg.system.dataRevision!==systemDataRevision(currentPackage.system)+1))throw new Error('Migração instalada exige revisão de dados v3 explicitamente incrementada em uma unidade.');
  if(migration===undefined && !dataRestoration && currentPackage && characters.length && (systemDataRevision(currentPackage.system)!==systemDataRevision(pkg.system)||currentPackage.system.schemaVersion===3&&currentPackage.system.dataRevision!==undefined&&pkg.system.dataRevision===undefined))throw new Error('Mudança de revisão dos dados exige migração explícita.');
  const dataMigration=migration===undefined?null:planDataMigration({base:currentPackage,candidate:pkg,characters,spec:migration});
  const transformation=dataMigration||dataRestoration;
  if(transformation?.status==='blocked' && !allowBlockedMigration)throw Object.assign(new Error((dataMigration?'Migração':'Restauração')+' bloqueada: '+[...transformation.diagnostics,...transformation.characters.flatMap(row=>row.conflicts)].map(issue=>issue.message).join('; ')),{migrationPlan:transformation});
  const warnings=[];
  for(const character of transformation?transformation.characters.map(row=>row.after):characters){const issues=validateCharacterForPackage(character,pkg);if(!transformation || transformation.status==='ready')assertValid(character,()=>issues,`personagem ${character.meta.id}`);warnings.push(...issues.filter(issue=>issue.severity==='warning'));}
  return {package:pkg,base:structuredClone(base ?? null),replace:Boolean(currentPackage),linkedIds:characters.map(character=>character.meta.id),warnings,...(dataMigration?{migration:dataMigration}:{}),...(dataRestoration?{restoration:dataRestoration}:{}),removedLayouts:(currentPackage?.layouts || []).filter(layout=>!pkg.layouts.some(next=>next.id===layout.id)).map(layout=>layout.id)};
}
