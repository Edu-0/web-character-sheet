// Runs only in the opaque preview. No parent DOM, app state or repositories.
export function previewNavigation({sources,controller,send}) {
  const nodes=new Map();let inspecting=false,composing=false,compositionToken=null,gesture=null,suppressClick=false,origin;
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
    inspecting=composing || enabled===true;document.body.toggleAttribute('data-editor-inspecting',inspecting);
  };
  const authoringHandle=pointer=>{document.querySelectorAll('.editor-canvas-handle').forEach(n=>n.remove());if(!composing||!['components','containers','sections'].some(kind=>pointer?.includes('/'+kind+'/')))return;const root=[...(nodes.get(pointer)||[])].find(n=>n.isConnected&&n.getClientRects().length);if(!root)return;const handle=document.createElement('button');handle.type='button';handle.className='editor-canvas-handle';handle.textContent='Mover este bloco';handle.setAttribute('aria-label','Arrastar definição deste bloco');handle.dataset.editorSource=pointer;root.append(handle);};
  const pick=node=>{if(node && sources.has(node.dataset.editorSource)){const definition=sources.get(node.dataset.editorSource);if(composing)authoringHandle(node.dataset.editorSource);if(composing&&definition.tabId)controller().activate(definition.tabId,{focus:false});if(composing&&node.matches('summary'))node.parentElement.open=!node.parentElement.open;send('source-picked',{pointer:node.dataset.editorSource});}};
  const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
  const cancelGesture=()=>{const current=gesture;gesture=null;if(current?.capture?.hasPointerCapture(current.pointerId))current.capture.releasePointerCapture(current.pointerId);document.querySelectorAll('[data-composition-hover]').forEach(n=>{n.removeAttribute('data-composition-hover');n.removeAttribute('data-composition-side');n.removeAttribute('data-composition-axis');});};
  const pointerdown=event=>{
    if(event.button!==0)return;
    const node=marked(event.target);
    if(!inspecting){gesture=null;suppressClick=false;origin=node?.dataset.editorSource;return;}
    gesture={node,x:event.clientX,y:event.clientY,...(composing&&event.target.closest('.editor-canvas-handle')?{dragSource:node.dataset.editorSource}:{})};suppressClick=true;
    if(gesture.dragSource){gesture.pointerId=event.pointerId;gesture.capture=event.target;event.target.setPointerCapture(event.pointerId);}
    // Keep touch scrolling available; suppress compatibility mouse events and
    // the eventual click so a label, disabled control or button cannot act.
    if(event.pointerType!=='touch'||gesture.dragSource)event.preventDefault();
    event.stopImmediatePropagation();
  };
  const pointerup=event=>{
    if(!gesture)return;
    const current=gesture;cancelGesture();stop(event);
    if(current.dragSource){const target=marked(document.elementFromPoint(event.clientX,event.clientY));if(target&&sources.has(target.dataset.editorSource)&&target.dataset.editorSource!==current.dragSource){const rect=target.getBoundingClientRect(),horizontal=target.parentElement?.matches('.engine-container--grid,.engine-container--flex'),after=horizontal?event.clientX>rect.left+rect.width/2:event.clientY>rect.top+rect.height/2;send('composition-drop',{token:compositionToken,source:current.dragSource,target:target.dataset.editorSource,after});}document.querySelectorAll('[data-composition-hover]').forEach(n=>n.removeAttribute('data-composition-hover'));return;}
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
    if(event.key==='Escape'){stop(event);const cancelledDrag=composing&&!!gesture?.dragSource;cancelGesture();suppressClick=cancelledDrag;if(!composing){inspect(false);send('inspection-ended');}return;}
    if(event.key==='Tab')return;
    stop(event);
    if(!event.repeat && (event.key==='Enter' || event.key===' '))pick(node);
  };
  const handlers={pointerdown,pointerup,pointermove:event=>{if(!gesture?.dragSource)return;stop(event);document.querySelectorAll('[data-composition-hover]').forEach(n=>n.removeAttribute('data-composition-hover'));const target=marked(document.elementFromPoint(event.clientX,event.clientY));if(target){const rect=target.getBoundingClientRect(),horizontal=target.parentElement?.matches('.engine-container--grid,.engine-container--flex');target.setAttribute('data-composition-hover','');target.dataset.compositionAxis=horizontal?'horizontal':'vertical';target.dataset.compositionSide=(horizontal?event.clientX>rect.left+rect.width/2:event.clientY>rect.top+rect.height/2)?'after':'before';}},click,mousedown:mouse,mouseup:mouse,dblclick:mouse,keydown,
    pointercancel:cancelGesture,lostpointercapture:cancelGesture,beforeinput:event=>{if(inspecting)stop(event);},
    paste:event=>{if(inspecting)stop(event);},drop:event=>{if(inspecting)stop(event);}};
  for(const [type,handler]of Object.entries(handlers))document.addEventListener(type,handler,true);
  window.addEventListener('blur',cancelGesture);window.addEventListener('resize',cancelGesture);
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
    geometry(){const rectangles=[];for(const [pointer,elements]of nodes){const node=[...elements].find(n=>n.isConnected&&!n.closest('[hidden]')&&n.getClientRects().length);if(!node)continue;const r=node.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)continue;rectangles.push({pointer,x:r.x,y:r.y,width:r.width,height:r.height});if(rectangles.length>=10000)break;}return rectangles;},
    scroll(delta){if(composing&&Number.isFinite(delta))window.scrollBy(0,Math.max(-120,Math.min(120,delta)));},
    register,inspect,compose(enabled,token){cancelGesture();composing=enabled===true;compositionToken=composing?token:null;document.querySelectorAll('.editor-canvas-handle').forEach(n=>n.remove());suppressClick=false;inspect(composing);},
    reveal(pointer,{focus=true,scroll=true}={}){
      for(const node of document.querySelectorAll('[data-editor-source-highlight]'))node.removeAttribute('data-editor-source-highlight');
      const definition=sources.get(pointer),targets=[...(nodes.get(pointer) || [])].filter(node=>node.isConnected);
      if(!definition || !targets.length)return {found:false,count:0};
      if(definition.tabId)controller().activate(definition.tabId,{focus:false});
      for(const target of targets){
        for(let parent=target.parentElement;parent;parent=parent.parentElement)if(parent.matches('details'))parent.open=true;
        target.setAttribute('data-editor-source-highlight','');
      }
      if(composing)authoringHandle(pointer);
      const first=targets.find(node=>node.getClientRects().length) || targets[0];
      if(!first.matches('[tabindex],input,textarea,select,button,summary'))first.tabIndex=-1;
      if(focus)first.focus({preventScroll:true});if(scroll)first.scrollIntoView({block:'center',behavior:'instant'});
      // Parent mobile panels may be hidden while a command is in flight. Count
      // rendered occurrences, excluding hidden tabs/modals within this frame.
      return {found:true,count:targets.filter(node=>!node.closest('[hidden]')).length};
    },
    destroy(){cancelGesture();window.removeEventListener('blur',cancelGesture);window.removeEventListener('resize',cancelGesture);observer.disconnect();for(const [type,handler]of Object.entries(handlers))document.removeEventListener(type,handler,true);nodes.clear();},
  };
}
