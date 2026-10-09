import {renderSheet} from '../engine/renderer.js';
import {setSystem} from '../engine/system.js';
import {setLayout} from '../engine/layout.js';
import '../systems/dnd2024-fields.js';
import '../systems/dnd-item-rolls.js';
import {prepareDocument} from '../validation/documents.js';
import {getHistory} from '../dice.js';
import {matchesPreview,previewMessage,PREVIEW_PROTOCOL} from './preview-protocol.js';
import {previewSources} from './source-navigation.js';
import {previewNavigation} from './preview-navigation.js';
import {pointerFor} from './source-map.js';

let port, context, character, controller, original, navigation;
const send = (type,payload={}) => port?.postMessage(previewMessage(type,context,payload));
function appearance(value) {
  for (const key of ['theme','palette','diceDisplay']) if (typeof value?.[key]==='string' && /^[a-z-]+$/.test(value[key])) document.documentElement.dataset[key]=value[key];
  document.documentElement.dataset.calculationControls='visible';
}
function bootstrap(event) {
  const message=event.data;
  if (event.source!==parent || message?.type!=='bootstrap' || message.protocol!==PREVIEW_PROTOCOL || message.nonce!==document.documentElement.dataset.nonce || event.ports.length!==1) return;
  window.removeEventListener('message',bootstrap);
  context=message.context; port=event.ports[0];
  port.onmessage=({data})=>{
    if (!matchesPreview(data,context,['mount','appearance','snapshot','dispose','inspect','reveal-source'])) return;
    try {
      if (data.type==='dispose') {navigation?.destroy();controller?.destroy();port.close();return;}
      if (data.type==='appearance') {appearance(data.appearance);return;}
      if (data.type==='snapshot') {send('snapshot',{requestId:data.requestId,character:structuredClone(character),history:structuredClone(getHistory()),migrationOriginal:original});return;}
      if (data.type==='inspect') {navigation?.inspect(data.enabled);return;}
      if (data.type==='reveal-source') {send('source-revealed',{requestId:data.requestId,...navigation.reveal(data.pointer)});return;}
      const prepared=prepareDocument(data.package,{kind:'package'});
      if (prepared.status!=='ready') throw new Error('Pacote de ensaio inválido.');
      const pkg=prepared.document, layout=pkg.layouts.find(layout=>layout.id===context.layoutId);
      if (!layout) throw new Error('Layout de ensaio ausente.');
      character=structuredClone(pkg.system.characterTemplate);
      character.meta={...character.meta,id:'editor-preview'};
      setSystem(pkg.system);setLayout(layout);appearance(data.appearance);
      const layoutIndex=pkg.layouts.indexOf(layout);
      navigation=previewNavigation({sources:previewSources(pkg,context.layoutId),controller:()=>controller,send});
      controller=renderSheet(document.getElementById('preview-sheet'),layout,character,{system:pkg.system,
        onRenderSource:(node,path)=>navigation.register(node,pointerFor(['layouts',layoutIndex,...path])),
        preview:true,onChange:()=>{},upgradeCharacter:async current=>{
          original=structuredClone(current); current.schemaVersion=2;current.activeEffects=[];
          if (prepareDocument(current,{kind:'character',pkg}).status!=='ready') throw new Error('Migração de ensaio inválida.');
        }});
      const eyebrow=document.querySelector('.engine-sheet__eyebrow'),title=document.querySelector('.engine-sheet__title');
      if(eyebrow)navigation.register(eyebrow,'/system/name');
      if(title)navigation.register(title,'/system/characterTemplate');
      // Empty margins also have an enclosing layout definition.
      document.body.dataset.editorSource=pointerFor(['layouts',layoutIndex]);
      send('rendered');
    } catch(error) { send('runtime-diagnostic',{message:error.message.slice(0,2000)}); }
  };
  port.start();send('ready');
}
window.addEventListener('message',bootstrap);
window.addEventListener('error',event=>send('runtime-diagnostic',{message:String(event.message).slice(0,2000)}));
window.addEventListener('unhandledrejection',event=>send('runtime-diagnostic',{message:String(event.reason?.message || event.reason).slice(0,2000)}));
