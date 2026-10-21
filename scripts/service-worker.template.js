// Gerado por build-offline.mjs: os hashes e a versão pertencem ao mesmo conjunto.
const VERSION = __VERSION__;
const ASSETS = __ASSETS__;
const SCOPE = self.registration.scope;
const PREFIX = `ficha-rpg-offline:${encodeURIComponent(SCOPE)}:`;
const CACHE = PREFIX + VERSION;
const urls = new Map(ASSETS.map(asset => [new URL(asset.path, SCOPE).href, asset]));

async function contentHash(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function withoutLiveReload(response, bytes, asset) {
  // Somente no desenvolvimento local: mantém o hash EXATO do arquivo original.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname) || !/\.(html|svg)$/.test(asset.path)) return null;
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const injected = /<!-- Code injected by (?:live-server|Five-server) -->\r?\n[ \t]*<script\b[^>]*>[\s\S]*?<\/script>/;
  const match = injected.exec(text);
  if (!match) return null;
  const end = match.index + match[0].length;
  // Servidores de desenvolvimento incluem quebra final e/ou indentação no bloco.
  const suffixes = new Set(['', text.slice(end).match(/^\r?\n/)?.[0], text.slice(end).match(/^\r?\n[ \t]*/)?.[0]]);
  for (const suffix of [...suffixes].filter(value => value !== undefined)) {
    const original = new TextEncoder().encode(text.slice(0, match.index) + text.slice(end + suffix.length));
    if (await contentHash(original) !== asset.hash) continue;
    const headers = new Headers(response.headers);
    for (const name of ['Content-Length', 'Content-Encoding', 'ETag']) headers.delete(name);
    return new Response(original, { status: response.status, statusText: response.statusText, headers });
  }
  return null;
}

async function verifiedResponse(url, asset) {
  let response;
  try { response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', redirect: 'error' }); }
  catch { throw new Error(`Não foi possível baixar ${asset.path}. Verifique a conexão e o servidor.`); }
  if (!response.ok) throw new Error(`O servidor não entregou ${asset.path} (HTTP ${response.status}).`);
  const bytes = await response.clone().arrayBuffer();
  if (await contentHash(bytes) !== asset.hash) {
    const original = await withoutLiveReload(response, bytes, asset);
    if (original) return original;
    throw new Error(`O arquivo ${asset.path} foi alterado após a preparação desta versão. Atualize os arquivos do aplicativo e tente novamente.`);
  }
  return response;
}

async function reportFailure(error) {
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
    if (client.url.startsWith(SCOPE)) client.postMessage({ type: 'OFFLINE_ERROR', message: error.message });
  }
}

async function cacheAssets(cache, missingOnly = false) {
  const queue = [...urls];
  // Limita também os reparos: baixar o catálogo inteiro de uma vez sobrecarrega
  // servidores locais. Aguarda todos os trabalhadores antes de relatar a falha.
  const results = await Promise.allSettled(Array.from({length: 4}, async () => {
    while (queue.length) {
      const [url, asset] = queue.shift();
      if (!missingOnly || !await cache.match(url)) await cache.put(url, await verifiedResponse(url, asset));
    }
  }));
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}
let repairing = null;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      try { await cacheAssets(cache); }
      catch (error) { await caches.delete(CACHE); throw error; }
    } catch (error) { await reportFailure(error); throw error; }
  })());
  // Updates stay waiting until all open app windows preserve their work.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
  // Prepared windows reload on controllerchange; initial installation does not reload.
});

async function serve(url, asset) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  try {
    // Recupera um arquivo removido pelo navegador somente se ainda for da mesma versão.
    const response = await verifiedResponse(url, asset); await cache.put(url, response.clone()); return response;
  } catch {
    return new Response('Esta versão não está disponível. Conecte-se e reabra o aplicativo.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requested = new URL(event.request.url);
  if (requested.origin !== self.location.origin) return;
  if (requested.pathname === new URL(SCOPE).pathname) requested.pathname += 'index.html';
  requested.search = ''; requested.hash = '';
  const asset = urls.get(requested.href);
  // Somente arquivos da lista pública. Não há cache dinâmico de docs/dados do usuário.
  if (asset) event.respondWith(serve(requested.href, asset));
});

let updatingApp = false;
async function activateUpdate(event) {
  const reply = message => event.ports[0].postMessage(message);
  if (updatingApp) { reply({ok:false,message:'Outra atualização já está em andamento.'}); return; }
  updatingApp = true;
  let windows = []; const transaction = crypto.randomUUID();
  try {
    const cache = await caches.open(CACHE);
    if (!(await Promise.all([...urls.keys()].map(url => cache.match(url)))).every(Boolean)) throw Error('A nova versão ainda não está completa. Verifique a conexão e tente novamente.');
    windows = (await self.clients.matchAll({includeUncontrolled:true,type:'window'})).filter(client => client.url.startsWith(SCOPE));
    const results = await Promise.all(windows.map(client => new Promise(resolve => {
      const channel = new MessageChannel();
      const finish = result => { clearTimeout(timer); channel.port1.close(); resolve(result); };
      const timer = setTimeout(() => finish({ready:false,message:'Uma aba está desatualizada ou não respondeu. Feche as outras abas do aplicativo e tente novamente.'}), 8000);
      channel.port1.onmessage = ({data}) => finish(data?.protocol === 1 ? data : {ready:false,message:'Feche as abas antigas do aplicativo e tente novamente.'});
      try { client.postMessage({type:'APP_UPDATE_PREPARE',transaction},[channel.port2]); } catch { finish({ready:false,message:'Não foi possível preparar uma das abas. Tente novamente.'}); }
    })));
    const failed = results.find(result => !result.ready);
    if (failed) throw Error(failed.message || 'Uma aba não conseguiu salvar suas alterações. A versão atual foi mantida.');
    const current = (await self.clients.matchAll({includeUncontrolled:true,type:'window'})).filter(client => client.url.startsWith(SCOPE));
    if (current.some(client => !windows.some(known => known.id === client.id))) throw Error('Outra aba foi aberta durante a atualização. Tente novamente.');
    reply({ok:true}); await self.skipWaiting();
  } catch (error) {
    for (const client of windows) client.postMessage({type:'APP_UPDATE_ABORT',transaction});
    reply({ok:false,message:error.message});
  } finally { updatingApp = false; }
}

self.addEventListener('message', event => {
  if(event.data?.type==='APP_UPDATE_ACTIVATE' && event.ports[0] && event.source?.url?.startsWith(SCOPE)){event.waitUntil(activateUpdate(event));return;}
  if(event.data?.type==='VERIFY_LIBRARY_WRITERS' && event.ports[0]){
    event.waitUntil((async()=>{
      const clients=(await self.clients.matchAll({includeUncontrolled:true,type:'window'})).filter(client=>client.url.startsWith(SCOPE));
      const checks=await Promise.all(clients.map(client=>new Promise(resolve=>{
        const channel=new MessageChannel(),timer=setTimeout(()=>finish('incompatible'),1500);
        const finish=safe=>{clearTimeout(timer);channel.port1.close();resolve(safe);};
        channel.port1.onmessage=({data})=>finish(data?.protocol!==3||data.locks!==true||typeof data.dirty!=='boolean'?'incompatible':event.data.requireCleanClients===true&&data.dirty?'dirty':'ready');
        client.postMessage({type:'LIBRARY_WRITE_PROBE'},[channel.port2]);
      })));
      event.ports[0].postMessage({protocol:3,safe:checks.every(check=>check==='ready'),reason:checks.includes('incompatible')?'incompatible':checks.includes('dirty')?'dirty':null,clients:clients.length});
    })());return;
  }
  if (!['OFFLINE_STATUS', 'OFFLINE_PREPARE'].includes(event.data?.type) || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      if (event.data.type === 'OFFLINE_PREPARE') {
        // Abas ou novas tentativas compartilham o reparo que já está em andamento.
        repairing ||= cacheAssets(cache, true).finally(() => { repairing = null; });
        await repairing;
      }
      const present = await Promise.all([...urls.keys()].map(async url => Boolean(await cache.match(url))));
      event.ports[0].postMessage({ ready: present.every(Boolean), version: VERSION });
    } catch (error) {
      await reportFailure(error);
      event.ports[0].postMessage({ready: false, version: VERSION, error: error.message});
    }
  })());
});
