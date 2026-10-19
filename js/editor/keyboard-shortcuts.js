// Reserved browser shortcuts and text editing keep their native behavior.
export function editorShortcut(event,{editing=false,area='sheet'}={}){
 if(event.defaultPrevented||event.isComposing||event.repeat)return null;
 const key=event.key?.toLowerCase(),mod=event.ctrlKey||event.metaKey;
 if(mod&&!event.altKey&&!event.shiftKey&&key==='s')return 'save';
 if(editing)return null;
 if(mod&&!event.altKey){
  if(key==='z')return event.shiftKey?'redo':'undo';
  if(key==='y'&&!event.shiftKey)return 'redo';
  if(key==='d'&&!event.shiftKey&&area==='sheet')return 'duplicate';
  return null;
 }
 if(key==='?'&&!event.altKey&&!mod)return 'shortcuts';
 if(area!=='sheet'||event.altKey||mod)return null;
 if(key==='f10'&&event.shiftKey||key==='contextmenu')return 'context';
 if(event.shiftKey)return null;
 return ({delete:'remove',insert:'add',a:'add',f2:'rename',p:'properties'})[key]||null;
}
