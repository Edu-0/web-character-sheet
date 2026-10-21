import { notify } from './notifications.js';

function requestStatus(worker, type = 'OFFLINE_STATUS', timeout = 5000) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, timeout);
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
    try { worker.postMessage({ type }, [channel.port2]); }
    catch { clearTimeout(timer); channel.port1.close(); resolve(null); }
  });
}

export function initPwa({ beforeReload }) {
  const $ = id => document.getElementById(id);
  const status = $('offline-status'), update = $('pwa-update-status'), install = $('btn-install-app');
  const reopen = $('btn-enable-offline'), check = $('btn-check-update'), connection = $('connection-indicator');
  const supported = isSecureContext && typeof navigator.serviceWorker?.register === 'function';
  let registration = null, prompt = null, busy = false, failure = '', refreshId = 0, checkedManually = false;
  let prepared = false, updating = false, reloading = false, blocker = null, releaseTimer = null, lastCheck = 0;
  let dismissedWorker = null, preparation = 0, preparedTransaction = null;
  // An initial install also passes through waiting briefly; it is not an update.
  const waitingUpdate = () => registration?.active?.state === 'activated' && registration.waiting?.state === 'installed' && registration.waiting !== registration.active ? registration.waiting : null;
  const banner = document.createElement('aside'); banner.className = 'pwa-update-banner'; banner.hidden = true;
  banner.setAttribute('aria-label', 'Atualização do aplicativo');
  const bannerText = document.createElement('p'); bannerText.setAttribute('role', 'status');
  const apply = document.createElement('button'); apply.type = 'button'; apply.className = 'button button--primary'; apply.textContent = 'Atualizar agora';
  const later = document.createElement('button'); later.type = 'button'; later.className = 'button button--ghost'; later.textContent = 'Depois';
  banner.append(bannerText, apply, later); document.body.append(banner);
  const settingsApply = apply.cloneNode(true); settingsApply.id = 'btn-apply-update'; settingsApply.hidden = true; check.before(settingsApply);
  later.addEventListener('click', () => { dismissedWorker = waitingUpdate(); banner.hidden = true; });
  const inertBefore = new Map(); let previousFocus = null;
  function unblock() {
    clearTimeout(releaseTimer); ++preparation; preparedTransaction = null; prepared = false; updating = false;
    blocker?.remove(); blocker = null;
    for (const [node, inert] of inertBefore) if (node.isConnected) node.inert = inert;
    inertBefore.clear(); previousFocus?.focus({preventScroll:true}); void refresh();
  }
  async function prepare(transaction) {
    if (prepared) return;
    if (document.querySelector('dialog[open],.modal-overlay:not([hidden])')) throw Error('Conclua ou cancele a janela de edição aberta e tente atualizar novamente.');
    const attempt = ++preparation; preparedTransaction = transaction;
    previousFocus = document.activeElement;
    blocker = document.createElement('div'); blocker.className = 'pwa-update-blocker'; blocker.tabIndex = -1;
    blocker.setAttribute('role','status'); blocker.textContent = 'Salvando suas alterações e atualizando o aplicativo…';
    for (const node of document.body.children) { inertBefore.set(node,node.inert); node.inert = true; }
    document.body.append(blocker); blocker.focus();
    releaseTimer = setTimeout(() => { if (!reloading) { failure = 'A atualização demorou. A versão atual foi mantida; tente novamente.'; unblock(); } }, 20000);
    try { await beforeReload(); if(attempt !== preparation) throw Error('A preparação foi cancelada. Tente novamente.'); prepared = true; }
    catch (error) { if(attempt === preparation) unblock(); throw error; }
  }
  async function applyUpdate() {
    const worker = waitingUpdate();
    if (updating || !worker) return;
    updating = true; failure = ''; void refresh();
    const result = await requestStatus(worker, 'APP_UPDATE_ACTIVATE', 16000);
    if (result?.ok) return; // controllerchange reloads each prepared window once.
    failure = result?.message || 'Não foi possível atualizar agora. Tente novamente; suas alterações continuam nesta aba.';
    unblock();
  }
  apply.addEventListener('click', applyUpdate); settingsApply.addEventListener('click', applyUpdate);
  const workerUrl = new URL('../sw.js', import.meta.url).href;
  const failureMessage = () => failure ? ` ${failure} Suas fichas continuam neste navegador.` : '';
  const display = matchMedia('(display-mode: standalone)');

  async function refresh() {
    const id = ++refreshId;
    connection.hidden = navigator.onLine; connection.textContent = 'Offline';
    check.disabled = !supported || !navigator.onLine || busy || registration?.installing?.state === 'installing';
    check.textContent = busy ? 'Preparando offline…' : 'Verificar / preparar offline';
    check.setAttribute('aria-busy', String(busy));
    install.hidden = !prompt || display.matches || navigator.standalone === true;
    reopen.hidden = true; update.hidden = true; settingsApply.hidden = !waitingUpdate(); apply.disabled = settingsApply.disabled = updating;
    if (!supported) { status.textContent = 'Uso offline indisponível neste endereço ou navegador. Use HTTPS ou localhost em um navegador compatível.'; return; }
    if (busy) status.textContent = 'Verificando a versão e preparando os arquivos para uso offline…';
    const worker = navigator.serviceWorker.controller || registration?.active;
    const result = worker ? await requestStatus(worker) : null;
    if (id !== refreshId) return;
    if (busy) {
      status.textContent = 'Verificando a versão e preparando os arquivos para uso offline…';
    } else if (result?.ready) {
      status.textContent = navigator.serviceWorker.controller
        ? `${navigator.onLine ? checkedManually && !failure ? 'Verificação concluída. Disponível offline.' : 'Disponível offline.' : 'Você está offline.'} Suas edições continuam salvas neste navegador.`
        : 'Preparação concluída. Reabra o app para ativar o uso offline.';
      reopen.hidden = Boolean(navigator.serviceWorker.controller);
    } else if (failure || worker) status.textContent = `Não foi possível concluir a preparação offline.${failureMessage() || ' Conecte-se e tente novamente; suas fichas continuam neste navegador.'}`;
    else status.textContent = navigator.onLine ? 'Preparando o aplicativo para uso offline…' : 'Conecte-se uma vez para preparar o uso offline.';
    const waiting = waitingUpdate();
    banner.hidden = !waiting || dismissedWorker === waiting;
    bannerText.textContent = failure || 'Nova versão disponível. Atualizar salva a ficha e o rascunho e reabre as abas do aplicativo.';
    if (waiting) {
      update.hidden = false;
      update.textContent = 'Atualização pronta. Use Atualizar agora para salvar suas alterações e reabrir as abas do aplicativo.' + (failure ? ' '+failure : '');
    } else if (registration?.installing && registration.active) {
      update.hidden = false; update.textContent = 'Preparando uma atualização. Você pode continuar usando a ficha.';
    } else if (failure && result?.ready) {
      update.hidden = false; update.textContent = `Não foi possível verificar ou preparar a atualização.${failureMessage()} A versão atual continua disponível offline.`;
    }
  }

  function watchWorker(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'redundant' && !failure) failure = 'O navegador interrompeu a preparação. Verifique a conexão e tente novamente.';
      void refresh();
    });
  }
  async function register() {
    registration = await navigator.serviceWorker.register(workerUrl, { updateViaCache: 'none' });
    registration.addEventListener('updatefound', () => { failure = ''; watchWorker(registration.installing); void refresh(); });
    watchWorker(registration.installing);
  }
  check.addEventListener('click', async () => {
    if (busy || updating || !supported || !navigator.onLine) return;
    busy = true; failure = ''; checkedManually = false; void refresh();
    try {
      // O worker não pertence ao cache público: confira o servidor real, inclusive
      // quando uma cópia antiga da página continua funcionando pelo cache.
      let response;
      try { response = await fetch(workerUrl, {cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000)}); }
      catch { throw Error('Não foi possível acessar sw.js. Verifique se o servidor está aberto nesta pasta e tente novamente.'); }
      if (!response.ok) throw Error(`O servidor não entregou sw.js (HTTP ${response.status}). No Five Server, abra a pasta do projeto e use root: '.'.`);
      if (!/javascript|ecmascript/i.test(response.headers.get('Content-Type') || '')) throw Error('O servidor entregou uma página em vez de sw.js. Confira a pasta raiz e a configuração do servidor.');
      if (!registration?.active && !registration?.waiting) await register(); else await registration.update();
      if (registration.active) {
        const current = await requestStatus(registration.active);
        if (!current) throw Error('O navegador não respondeu à verificação offline. Reabra o app e tente novamente.');
        if (!current.ready) {
          const result = await requestStatus(registration.active, 'OFFLINE_PREPARE', 30000);
          if (!result?.ready) throw Error(result?.error || 'A preparação ainda não foi confirmada. Aguarde os downloads e verifique novamente com o servidor conectado.');
        }
      }
      checkedManually = true;
    } catch (error) { failure = error.message; }
    finally { busy = false; void refresh(); }
  });
  reopen.addEventListener('click', async () => {
    try { await beforeReload(); location.reload(); }
    catch (error) { notify(error.message, { type: 'error' }); }
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; void refresh();
  });
  install.addEventListener('click', async () => {
    const pending = prompt;
    if (!pending) return;
    prompt = null; install.hidden = true;
    try { await pending.prompt(); await pending.userChoice; }
    catch { notify('Use a opção de instalar no menu do navegador.'); }
    void refresh();
  });
  window.addEventListener('appinstalled', () => { prompt = null; void refresh(); });
  display.addEventListener('change', () => { void refresh(); });
  async function checkAutomatically() {
    if (!registration || !navigator.onLine || document.visibilityState !== 'visible' || busy || updating || blocker || Date.now()-lastCheck < 60000) return;
    lastCheck = Date.now();
    try { await registration.update(); } catch { /* Connection status is advisory; keep the working version. */ }
    void refresh();
  }
  window.addEventListener('online', () => { void refresh(); lastCheck = 0; void checkAutomatically(); });
  window.addEventListener('offline', () => { void refresh(); });
  window.addEventListener('focus', checkAutomatically);
  document.addEventListener('visibilitychange', checkAutomatically);
  setInterval(checkAutomatically, 60000);
  if (supported) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.source?.scriptURL === workerUrl && event.source === waitingUpdate()) {
        if (event.data?.type === 'APP_UPDATE_PREPARE' && event.ports[0]) {
          void prepare(event.data.transaction).then(() => event.ports[0].postMessage({protocol:1,ready:true}), error => event.ports[0].postMessage({protocol:1,ready:false,message:error.message})); return;
        }
        if (event.data?.type === 'APP_UPDATE_ABORT') { if(event.data.transaction === preparedTransaction) unblock(); return; }
      }
      if (event.source?.scriptURL !== workerUrl || event.data?.type !== 'OFFLINE_ERROR' || typeof event.data.message !== 'string') return;
      failure = event.data.message.slice(0, 500); void refresh();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (prepared && !reloading) { reloading = true; clearTimeout(releaseTimer); location.reload(); return; }
      void refresh();
    });
    void register().catch(error => { failure = error.message; }).finally(() => { void refresh(); });
  }
  void refresh();
}
