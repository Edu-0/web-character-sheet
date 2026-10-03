import { notify } from './notifications.js';

function requestStatus(worker, type = 'OFFLINE_STATUS') {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); resolve(null); }, 5000);
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
  let registration = null, prompt = null, busy = false, failure = '', refreshId = 0;
  const workerUrl = new URL('../sw.js', import.meta.url).href;
  const failureMessage = () => failure ? ` ${failure} Suas fichas continuam neste navegador.` : '';
  const display = matchMedia('(display-mode: standalone)');

  async function refresh() {
    const id = ++refreshId;
    connection.hidden = navigator.onLine; connection.textContent = 'Offline';
    check.disabled = !supported || !navigator.onLine || busy || registration?.installing?.state === 'installing';
    install.hidden = !prompt || display.matches || navigator.standalone === true;
    reopen.hidden = true; update.hidden = true;
    if (!supported) { status.textContent = 'Uso offline indisponível neste endereço ou navegador. Use HTTPS ou localhost em um navegador compatível.'; return; }
    const worker = navigator.serviceWorker.controller || registration?.active;
    const result = worker ? await requestStatus(worker) : null;
    if (id !== refreshId) return;
    if (result?.ready) {
      status.textContent = navigator.serviceWorker.controller
        ? `${navigator.onLine ? 'Disponível offline.' : 'Você está offline.'} Suas edições continuam salvas neste navegador.`
        : 'Preparação concluída. Reabra o app para ativar o uso offline.';
      reopen.hidden = Boolean(navigator.serviceWorker.controller);
    } else if (failure || worker) status.textContent = `Não foi possível concluir a preparação offline.${failureMessage() || ' Conecte-se e tente novamente; suas fichas continuam neste navegador.'}`;
    else status.textContent = navigator.onLine ? 'Preparando o aplicativo para uso offline…' : 'Conecte-se uma vez para preparar o uso offline.';
    if (registration?.waiting && registration.active) {
      update.hidden = false;
      update.textContent = 'Atualização pronta. Feche todas as abas e janelas do Ficha RPG e reabra para aplicá-la. Suas fichas salvas serão mantidas.';
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
    if (busy || !supported || !navigator.onLine) return;
    busy = true; failure = ''; void refresh();
    try {
      if (!registration?.active && !registration?.waiting) await register(); else await registration.update();
      if (registration.active) {
        const current = await requestStatus(registration.active);
        if (current && !current.ready && !(await requestStatus(registration.active, 'OFFLINE_PREPARE'))?.ready && !failure) failure = 'Alguns arquivos ainda estão indisponíveis. Tente novamente com o servidor conectado.';
      }
    } catch (error) { failure = error.message; }
    finally { busy = false; void refresh(); }
  });
  reopen.addEventListener('click', () => {
    try { beforeReload(); location.reload(); }
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
  for (const event of ['online', 'offline']) window.addEventListener(event, () => { void refresh(); });
  if (supported) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.source?.scriptURL !== workerUrl || event.data?.type !== 'OFFLINE_ERROR' || typeof event.data.message !== 'string') return;
      failure = event.data.message.slice(0, 500); void refresh();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { void refresh(); });
    void register().catch(error => { failure = error.message; }).finally(() => { void refresh(); });
  }
  void refresh();
}
