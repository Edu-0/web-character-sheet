// Runs only in the opaque preview. No parent DOM, app state or repositories.
export function previewNavigation({sources,controller,send}) {
  const nodes=new Map();let inspecting=false,gesture=null,suppressClick=false,origin;
  const marked=target=>target instanceof Element ? target.closest('[data-editor-source]') : target?.parentElement?.closest('[data-editor-source]');
  const register=(node,pointer)=>{
    if(!sources.has(pointer))return;
    if(node.dataset.editorSource!==pointer)nodes.get(node.dataset.editorSource)?.delete(node);
    node.dataset.editorSource=pointer;
    if(!nodes.has(pointer))nodes.set(pointer,new Set());
    nodes.get(pointer).add(node);
    // Help can move to body in the fallback without native popovers.
    for(const panel of node.querySelectorAll('.engine-help__panel'))panel.dataset.editorSource=pointer;
  };
  const inspect=enabled=>{
    inspecting=enabled===true;document.body.toggleAttribute('data-editor-inspecting',inspecting);
  };
  const pick=node=>{if(node && sources.has(node.dataset.editorSource))send('source-picked',{pointer:node.dataset.editorSource});};
  const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const pointerdown=event=>{
    if(event.button!==0)return;
    const node=marked(event.target);
    if(!inspecting){gesture=null;suppressClick=false;origin=node?.dataset.editorSource;return;}
    gesture={node,x:event.clientX,y:event.clientY};suppressClick=true;
    // Keep touch scrolling available; suppress compatibility mouse events and
    // the eventual click so a label, disabled control or button cannot act.
    if(event.pointerType!=='touch')event.preventDefault();
    event.stopImmediatePropagation();
  };
  const pointerup=event=>{
    if(!gesture)return;
    const current=gesture;gesture=null;stop(event);
    if(Math.hypot(event.clientX-current.x,event.clientY-current.y)<10)pick(current.node);
  };
  const click=event=>{
    if(inspecting || suppressClick){stop(event);if(!suppressClick)pick(marked(event.target));suppressClick=false;}
    else origin=marked(event.target)?.dataset.editorSource;
  };
  const mouse=event=>{if(inspecting || gesture || suppressClick)stop(event);};
  const keydown=event=>{
    const node=marked(event.target);
    if(!inspecting){gesture=null;suppressClick=false;origin=node?.dataset.editorSource;return;}
    if(event.key==='Escape'){stop(event);inspect(false);send('inspection-ended');return;}
    if(event.key==='Tab')return;
    stop(event);
    if(!event.repeat && (event.key==='Enter' || event.key===' '))pick(node);
  };
  const handlers={pointerdown,pointerup,click,mousedown:mouse,mouseup:mouse,dblclick:mouse,keydown,
    pointercancel:()=>{gesture=null;},beforeinput:event=>{if(inspecting)stop(event);},
    paste:event=>{if(inspecting)stop(event);},drop:event=>{if(inspecting)stop(event);}};
  for(const [type,handler]of Object.entries(handlers))document.addEventListener(type,handler,true);
  // Modals live outside the component subtree; associate them with the action
  // that opened them, including keyboard activation, rather than guessing text.
  const observer=new MutationObserver(records=>{
    const dialogs=new Set();
    for(const record of records){
      const containing=record.target.closest?.('[role=dialog]');if(containing)dialogs.add(containing);
      for(const node of record.addedNodes)if(node instanceof Element){
        if(node.matches('[role=dialog]'))dialogs.add(node);
        for(const dialog of node.querySelectorAll('[role=dialog]'))dialogs.add(dialog);
        if(node.matches('.engine-help__panel')){
          const trigger=[...document.querySelectorAll('.engine-help__trigger[aria-controls]')].find(button=>button.getAttribute('aria-controls')===node.id);
          const pointer=marked(trigger)?.dataset.editorSource;if(sources.has(pointer))node.dataset.editorSource=pointer;
        }
      }
    }
    for(const dialog of dialogs)if(origin)register(dialog,origin);
  });observer.observe(document.body,{childList:true,subtree:true});
  return {
    register,inspect,
    reveal(pointer){
      for(const node of document.querySelectorAll('[data-editor-source-highlight]'))node.removeAttribute('data-editor-source-highlight');
      const definition=sources.get(pointer),targets=[...(nodes.get(pointer) || [])].filter(node=>node.isConnected);
      if(!definition || !targets.length)return {found:false,count:0};
      if(definition.tabId)controller().activate(definition.tabId,{focus:false});
      for(const target of targets){
        for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.matches('details'))parent.open=true;
        target.setAttribute('data-editor-source-highlight','');
      }
      const first=targets.find(node=>node.getClientRects().length) || targets[0];
      if(!first.matches('[tabindex],input,textarea,select,button,summary'))first.tabIndex=-1;
      first.focus({preventScroll:true});first.scrollIntoView({block:'center',behavior:'instant'});
      // Parent mobile panels may be hidden while a command is in flight. Count
      // rendered occurrences, excluding hidden tabs/modals within this frame.
      return {found:true,count:targets.filter(node=>!node.closest('[hidden]')).length};
    },
    destroy(){observer.disconnect();for(const [type,handler]of Object.entries(handlers))document.removeEventListener(type,handler,true);nodes.clear();},
  };
}
