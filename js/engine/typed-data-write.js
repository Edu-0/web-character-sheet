import {writeData} from './data-definitions.js';
import {validateDataDefinitions} from '../validation/data-definitions.js';

// One character and the existing writer; check the complete candidate before mutation.
export function writeValidatedData(system,character,dataId,cell,context={}){
  const candidate=structuredClone(character);
  writeData(system,candidate,dataId,cell,context);
  const issues=validateDataDefinitions(system,candidate,'character');
  if(issues.length)throw new Error(issues[0].message);
  writeData(system,character,dataId,cell,context);
}
