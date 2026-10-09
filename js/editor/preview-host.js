import {PREVIEW_PROTOCOL,matchesPreview,previewMessage} from './preview-protocol.js';
import {previewSources} from './source-navigation.js';

let assets;
async function runtimeAssets() {
  assets ||= Promise.all(['./generated/preview.js','./generated/preview.css'].map(async path=>{
    const response=await fetch(new URL(path,import.meta.url)); if (!response.ok) throw new Error('Runtime de prévia indisponível.');return response.text();
  })).catch(error=>{assets=null;throw error;});
  return assets;
}
const attrs = () => Object.fromEntries(['theme','palette','diceDisplay'].map(key=>[key,document.documentElement.dataset[key] || '']));
export class PreviewHost {
  constructor(host,{sessionId=crypto.randomUUID(),onDiagnostic=()=>{},onSource=()=>{},onInspectionEnd=()=>{}}={}) {this.host=host;this.sessionId=sessionId;this.generation=0;this.onDiagnostic=onDiagnostic;this.onSource=onSource;this.onInspectionEnd=onInspectionEnd;this.pending=new Set();}
  async mount(pkg,{revision,layoutId,appearance=attrs()}={}) {
    for(const record of this.pending)this.destroyRecord(record);
    const generation=++this.generation, context={sessionId:this.sessionId,generation,revision,layoutId};
    const [script,css]=await runtimeAssets(); if (generation!==this.generation) throw new Error('Prévia superada.');
    const nonce=crypto.randomUUID().replaceAll('-',''), frame=document.createElement('iframe');
    frame.title='Ensaio isolado da ficha'; frame.setAttribute('sandbox','allow-scripts');frame.className='editor-preview-frame';
    const csp=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'`;
    frame.srcdoc=`<!doctype html><html lang="pt-BR" data-nonce="${nonce}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${css.replace(/<\/style/gi,'<\\/style')}</style></head><body><main id="preview-sheet"></main><script nonce="${nonce}">${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
    const channel=new MessageChannel(), record={frame,port:channel.port1,context,sources:previewSources(pkg,layoutId)};this.pending.add(record);
    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>finish(new Error('Prévia não respondeu em 15 segundos.')),15000);
      const finish=error=>{clearTimeout(timer);record.cancel=null;if(error) reject(error);else resolve(record);};
      record.cancel=()=>finish(new Error('Prévia descartada.'));
      channel.port1.onmessage=({data})=>{
        if (generation!==this.generation && record!==this.current || !matchesPreview(data,context,['ready','rendered','runtime-diagnostic','snapshot','source-picked','source-revealed','inspection-ended'])) return;
        if (data.type==='ready') channel.port1.postMessage(previewMessage('mount',context,{package:pkg,appearance}));
        if (data.type==='rendered') finish();
        if (data.type==='runtime-diagnostic') {this.onDiagnostic(data.message);finish(new Error(data.message));}
        if (data.type==='snapshot') record.requests?.get(data.requestId)?.(data);
        if (data.type==='source-revealed') record.requests?.get(data.requestId)?.(data);
        if (data.type==='source-picked' && record===this.current && record.sources.has(data.pointer)) this.onSource({pointer:data.pointer,...context});
        if (data.type==='inspection-ended' && record===this.current) this.onInspectionEnd();
      };
      channel.port1.start();
      frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'bootstrap',protocol:PREVIEW_PROTOCOL,nonce,context},'*',[channel.port2]),{once:true});
      frame.hidden=true;this.host.append(frame);
    }).catch(error=>{this.destroyRecord(record);throw error;});
    this.pending.delete(record);
    if (generation!==this.generation) {this.destroyRecord(record);throw new Error('Prévia superada.');}
    this.destroyRecord(this.current);this.current=result;frame.hidden=false;return context;
  }
  request(type,payload={}) {
    const record=this.current;if (!record) return Promise.reject(new Error('Sem prévia.'));
    return new Promise((resolve,reject)=>{
      const id=crypto.randomUUID(), timer=setTimeout(()=>{record.requests.delete(id);reject(new Error('Ensaio não respondeu.'));},2000);
      record.requests ||= new Map();const respond=data=>{clearTimeout(timer);record.requests.delete(id);resolve(data);};respond.cancel=()=>{clearTimeout(timer);record.requests.delete(id);reject(new Error('Ensaio descartado.'));};record.requests.set(id,respond);
      record.port.postMessage(previewMessage(type,record.context,{requestId:id,...payload}));
    });
  }
  snapshot() {return this.request('snapshot');}
  revealSource(pointer) {
    if(!this.current?.sources.has(pointer))return Promise.reject(new Error('Trecho sem elemento nesta prévia.'));
    return this.request('reveal-source',{pointer});
  }
  inspect(enabled) {if(this.current)this.current.port.postMessage(previewMessage('inspect',this.current.context,{enabled:enabled===true}));}
  appearance(appearance) {if(this.current)this.current.port.postMessage(previewMessage('appearance',this.current.context,{appearance}));}
  destroyRecord(record) {if (!record)return;record.cancel?.();for(const request of record.requests?.values() || [])request.cancel();record.port.postMessage(previewMessage('dispose',record.context));record.port.close();record.frame.remove();this.pending.delete(record);}
  dispose() {this.generation++;for(const record of this.pending)this.destroyRecord(record);this.destroyRecord(this.current);this.current=null;}
}
