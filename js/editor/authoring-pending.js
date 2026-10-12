// These are markers in the existing UI sidecar, never another document or writer.
const roots=new Set(['typedInputs','typedRules','structuredInputs','authoringInputs','dataInputs','ruleGraph','layoutInputs','variableInputs','repeatInputs','formInputs']);
const reserved=new Set(['__proto__','prototype','constructor']);
export function markAuthoringPending(view,key,{raw='',cleanupPaths=[],label='Construção em edição'}={}){
 const ui=view.session.ui;ui.formPending??={};ui.formPending[key]={raw:String(raw),mode:'authoring',builder:'authoring',label,cleanupPaths:structuredClone(cleanupPaths)};view.onPending?.();
}
export function discardAuthoringPending(ui,key){
 const pending=ui.formPending?.[key];delete ui.formPending?.[key];
 for(const path of Array.isArray(pending?.cleanupPaths)?pending.cleanupPaths:[]){if(!Array.isArray(path)||!roots.has(path[0])||path.some(part=>reserved.has(String(part))))continue;let owner=ui;for(const part of path.slice(0,-1)){if(!owner||typeof owner!=='object'||!Object.hasOwn(owner,part)){owner=null;break;}owner=owner[part];}if(owner&&typeof owner==='object')delete owner[path.at(-1)];}
}
export function commitAuthoringPending(view,keys,commands,label,selection){
 const ui=view.session.ui,saved=keys.map(key=>[key,ui.formPending?.[key]]);for(const key of keys)delete ui.formPending?.[key];
 const restore=()=>{ui.formPending??={};for(const [key,pending]of saved)if(pending)ui.formPending[key]=pending;view.onPending?.();};
 const finish=result=>{if(result===false)restore();return result;};
 try{const result=view.commit(commands,label,selection);return result&&typeof result.then==='function'?result.then(finish,error=>{restore();throw error;}):finish(result);}catch(error){restore();throw error;}
}
// Each inclusion form has its own recoverable UI draft. Navigation remains shared.
export function inclusionDraft(ui,kind){
 const navigation=ui.authoringInputs??={};navigation.inclusions??={};
 const legacy=navigation.inclusionDraftsVersion!==1;navigation.inclusionDraftsVersion=1;
 if(legacy)for(const [type,value]of Object.entries(navigation.ruleDrafts||{})){
  navigation.inclusions[type]??={};navigation.inclusions[type].ruleDrafts={[type]:structuredClone(value)};
 }
 if(!Object.hasOwn(navigation.inclusions,kind)){
  const draft={};
  navigation.inclusions[kind]=draft;
 }
 if(legacy&&navigation.type===kind)for(const [key,value]of Object.entries(navigation)){
  if(['inclusions','inclusionDraftsVersion','type','search','configuring','canvasPosition','ruleDrafts'].includes(key))continue;
  navigation.inclusions[kind][key]=structuredClone(value);
 }
 return navigation.inclusions[kind];
}
