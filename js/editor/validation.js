import { prepareDocument } from '../validation/documents.js';
import { LIMITS } from '../validation/limits.js';
import { parseSource, locateDiagnostic } from './source-map.js';

export const VALIDATOR_VERSION = 1;
export function validateText(text) {
  if (new TextEncoder().encode(text).length > LIMITS.systemBytes) return {status:'invalid',diagnostics:[{severity:'error',code:'json.bytes',pointer:'',message:'Pacote excede 4 MiB; o texto foi preservado.'}],locations:new Map()};
  const parsed = parseSource(text);
  if (parsed.diagnostics.length) return {status:'invalid',...parsed};
  const prepared = prepareDocument(parsed.value,{kind:'package',normalize:true});
  return {...prepared,value:parsed.value,locations:parsed.locations,diagnostics:prepared.diagnostics.map(diagnostic=>({...diagnostic,location:locateDiagnostic(text,parsed.locations,diagnostic)}))};
}
