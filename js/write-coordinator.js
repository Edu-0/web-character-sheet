// Every library read-modify-write runs synchronously inside one origin-wide lock.
// No user confirmation, fetch or arbitrary await is allowed in the critical section.
// Version 2 clients understand removable catalogue installations. A version 1
// client can still create characters for a removed builtin, so it cannot approve
// destructive writes even though it already shares the origin-wide lock.
export const WRITE_PROTOCOL=2;
export const LIBRARY_LOCK='ficha-rpg:library-write:v1';
let writing=false, queue=Promise.resolve(),pendingWrites=0;
export const hasPendingLibraryWrites=()=>pendingWrites>0;
export const flushLibraryWrites=()=>withLibraryWrite(()=>{});
const PRESENCE='ficha-rpg:writer-presence:v1:';
const actor=globalThis.document ? crypto.randomUUID() : null;
let sharedState={sequence:0,values:[]},storageAdapter, releasePresence;
export function registerLibraryStorage(adapter){storageAdapter=adapter;}
let channel;
const probes=new Map();
function connectChannel(){
  channel=actor && globalThis.BroadcastChannel ? new BroadcastChannel('ficha-rpg:library-handoff:v1') : null;
  channel?.addEventListener('message',({data})=>{
  if(data?.protocol!==WRITE_PROTOCOL)return;
  if(data.type==='probe' && data.targets?.includes(actor))channel.postMessage({type:'reply',protocol:WRITE_PROTOCOL,requestId:data.requestId,actor,state:sharedState});
  if(data.type==='reply')probes.get(data.requestId)?.(data);
  });
}
connectChannel();
function claimPresence(){return actor && coordinatedWritesAvailable() ? new Promise(resolve=>{
  navigator.locks.request(PRESENCE+actor,()=>{resolve();return new Promise(release=>{releasePresence=release;});}).catch(()=>resolve());
}) : Promise.resolve();}
let presenceReady=claimPresence();
globalThis.addEventListener?.('pagehide',()=>{releasePresence?.();releasePresence=null;channel?.close();channel=null;});
globalThis.addEventListener?.('pageshow',event=>{if(event.persisted){connectChannel();presenceReady=claimPresence();}});
async function handoff() {
  if(!channel || !storageAdapter)return;
  const query=await navigator.locks.query(),peers=query.held.filter(lock=>lock.name.startsWith(PRESENCE) && lock.name!==PRESENCE+actor).map(lock=>lock.name.slice(PRESENCE.length));
  let freshest=sharedState;
  if(peers.length)await new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID(),pending=new Set(peers);
    const timer=setTimeout(async()=>{
      const current=await navigator.locks.query();
      for(const peer of pending)if(!current.held.some(lock=>lock.name===PRESENCE+peer))pending.delete(peer);
      finish(pending.size?new Error('Uma janela de escrita não respondeu. Preserve a edição e tente novamente após reabrir essa janela.'):null);
    },3000);
    const finish=error=>{clearTimeout(timer);probes.delete(requestId);error?reject(error):resolve();};
    probes.set(requestId,data=>{if(!pending.has(data.actor) || !Number.isSafeInteger(data.state?.sequence) || !Array.isArray(data.state.values))return;pending.delete(data.actor);if(data.state.sequence>freshest.sequence)freshest=data.state;if(!pending.size)finish();});
    channel.postMessage({type:'probe',protocol:WRITE_PROTOCOL,requestId,targets:peers});
  });
  // Storage events can lag a lock acquisition in Chromium. Hand off the last
  // writer's authoritative strings instead of assuming its cache is visible.
  storageAdapter.adopt(peers.length || freshest.sequence>sharedState.sequence?freshest.values:storageAdapter.live());
  sharedState={sequence:freshest.sequence,values:freshest.values};
}
export const inLibraryWrite=()=>writing;
export function coordinatedWritesAvailable(){return Boolean(globalThis.navigator?.locks?.request && (!actor || globalThis.BroadcastChannel));}
export function withLibraryWrite(operation) {
  pendingWrites++;
  const finish=task=>task.finally(()=>pendingWrites--);
  const execute=()=>{
    if(writing)throw new Error('Escrita aninhada não autorizada.');
    writing=true;
    try {const result=operation();if(result?.then)throw new Error('A seção de escrita deve ser síncrona.');return result;}
    finally{writing=false;}
  };
  if(coordinatedWritesAvailable())return finish(presenceReady.then(()=>navigator.locks.request(LIBRARY_LOCK,async()=>{await handoff();try{return execute();}finally{if(storageAdapter)sharedState={sequence:sharedState.sequence+1,values:storageAdapter.snapshot()};}})));
  const task=queue.catch(()=>{}).then(execute);queue=task;return finish(task);
}
globalThis.navigator?.serviceWorker?.addEventListener('message',event=>{
  if(event.data?.type==='LIBRARY_WRITE_PROBE' && event.ports[0])event.ports[0].postMessage({protocol:WRITE_PROTOCOL,locks:coordinatedWritesAvailable()});
});
export async function verifyWriterClients() {
  if(!coordinatedWritesAvailable())throw new Error('Web Locks indisponível: alteração da biblioteca bloqueada. Você pode editar e exportar.');
  if(!navigator.serviceWorker)throw new Error('Não foi possível verificar as janelas antigas. Reabra o aplicativo antes de alterar a biblioteca.');
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Prepare o uso offline e reabra o aplicativo para verificar as janelas antigas.')),4000))]);
  if(!registration.active)throw new Error('Verificação de janelas indisponível.');
  const channel=new MessageChannel();
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Versão antiga do aplicativo: feche e reabra suas janelas antes de alterar a biblioteca.')),4000);
    const finish=error=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve();};
    channel.port1.onmessage=({data})=>finish(data?.protocol===WRITE_PROTOCOL && data?.safe?null:new Error('Há janela antiga ou sem coordenação. Feche e reabra as janelas do aplicativo antes de alterar a biblioteca.'));
    registration.active.postMessage({type:'VERIFY_LIBRARY_WRITERS',protocol:WRITE_PROTOCOL},[channel.port2]);
  });
}
