import { inspectJson } from './limits.js';
import { versionIssue } from './versions.js';
import { diagnosticsFor } from './diagnostics.js';
import { validateManifest, validateSystemPackage, validateSystem, validateLayout, validateCharacter, validateCharacterForPackage } from './schemas.js';
import { planNormalization } from '../migrations/index.js';
import {validateLibraryBackup} from './backup.js';

export function prepareDocument(input, {kind, pkg, normalize = false, allowMissingId = false} = {}) {
  const safety = inspectJson(input,kind);
  const unsupported = versionIssue(input,kind);
  let document = input, migrationPlan;
  let issues = safety.length ? safety : unsupported ? [unsupported] : [];
  if (!issues.length && normalize) {
    try { migrationPlan = planNormalization(input,kind,{pkg}); document = migrationPlan.document; }
    catch (error) { issues.push({path:kind,message:error.message,code:'migration.conflict'}); }
  }
  if (!issues.length) {
    const validators = { manifest:validateManifest, package:validateSystemPackage, system:validateSystem,
      layout:value=>validateLayout(value,{system:pkg?.system}), character:value=>pkg ? validateCharacterForPackage(value,pkg,{allowMissingId}) : validateCharacter(value,{allowMissingId}),backup:validateLibraryBackup };
    if (!validators[kind]) issues.push({path:kind,message:'Família de documento desconhecida.',code:'document.kind'});
    else { try { issues = validators[kind](document); } catch(error) { issues.push({path:kind,message:error.message,code:'document.invalid'}); } }
  }
  const diagnostics = diagnosticsFor(issues,document,kind);
  const errors = diagnostics.filter(issue=>issue.severity==='error');
  const status = errors.length ? (errors.some(issue=>issue.code==='schema-version') ? 'unsupported' : 'invalid') : migrationPlan?.changes.length ? 'needsMigration' : 'ready';
  return {status, document: errors.length ? undefined : structuredClone(document), diagnostics, ...(migrationPlan?.changes.length ? {migrationPlan} : {})};
}
