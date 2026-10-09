import {pointerFor} from './source-map.js';

// Textarea exposes LF line endings, even when the authoritative file contains
// CRLF. Translate caret offsets; never normalize or rewrite the source text.
export function textareaOffset(text,offset) {
  let removed=0;
  for(let index=0;index<offset;index++)if(text[index]==='\r' && text[index+1]==='\n')removed++;
  return offset-removed;
}
export function sourceOffset(text,offset) {
  let raw=0,display=0;
  while(raw<text.length && display<offset){raw+=text[raw]==='\r' && text[raw+1]==='\n'?2:1;display++;}
  return raw;
}

// Only rendered definitions have a visual target. Unknown rules/extras must not
// silently fall back to an unrelated component or to the whole package.
export function previewSources(pkg, layoutId) {
  const sources=new Map(), layoutIndex=pkg?.layouts?.findIndex(layout=>layout.id===layoutId) ?? -1;
  if(layoutIndex<0)return sources;
  const add=(path,tabId)=>sources.set(pointerFor(path),{tabId});
  const base=['layouts',layoutIndex],layout=pkg.layouts[layoutIndex];
  add(base);
  (layout.tabs || []).forEach((tab,t)=>{
    const tabPath=[...base,'tabs',t];add(tabPath,tab.id);
    (tab.sections || []).forEach((section,s)=>{
      const sectionPath=[...tabPath,'sections',s];add(sectionPath,tab.id);
      (section.containers || []).forEach((container,c)=>{
        const containerPath=[...sectionPath,'containers',c];add(containerPath,tab.id);
        (container.components || []).forEach((_,i)=>add([...containerPath,'components',i],tab.id));
      });
    });
  });
  if(layout.showHeader!==false) {
    add(['system','name']);
    // The title represents the template, rather than a field in the layout.
    add(['system','characterTemplate']);
  }
  return sources;
}

export function sourceAtOffset(locations, sources, offset) {
  let selected, size=Infinity;
  for(const pointer of sources.keys()) {
    const range=locations.get(pointer);
    if(range && range.start<=offset && offset<range.end && range.end-range.start<size) {
      selected=pointer;size=range.end-range.start;
    }
  }
  return selected;
}
