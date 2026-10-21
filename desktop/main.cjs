const {app, BrowserWindow, protocol, session, shell, Menu, dialog} = require('electron');
const {join, resolve} = require('node:path');
const {mkdirSync} = require('node:fs');
const {APP_ORIGIN, publicPath, createPublicHandler} = require('./runtime.cjs');

protocol.registerSchemesAsPrivileged([{scheme:'ficha', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true}}]);
app.setAppUserModelId('br.ficharpg.desktop');
// A portable profile travels beside the exe. Installed releases keep a stable profile.
const profile = process.env.FICHA_DESKTOP_TEST_PROFILE || (process.env.PORTABLE_EXECUTABLE_DIR
  ? join(process.env.PORTABLE_EXECUTABLE_DIR, 'Ficha RPG Dados')
  : join(app.getPath('appData'), 'Ficha RPG'));
mkdirSync(profile, {recursive:true});
app.setPath('userData', resolve(profile));
app.setPath('sessionData', resolve(profile));

let main;
const external = url => { try { if (new URL(url).protocol === 'https:') void shell.openExternal(url); } catch {} };
function protect(window, documentUrl = `${APP_ORIGIN}/index.html`) {
  const documentPath = publicPath(documentUrl);
  window.webContents.on('will-navigate', (event, url) => {
    if (publicPath(url) !== documentPath) { event.preventDefault(); external(url); }
  });
  window.webContents.setWindowOpenHandler(({url}) => {
    const path = publicPath(url);
    if (path && (path.startsWith('data/examples/') && path.endsWith('.md') || ['LICENSE','THIRD_PARTY_NOTICES.md','assets/artwork/README.md'].includes(path))) {
      return {action:'allow', overrideBrowserWindowOptions:{webPreferences:{nodeIntegration:false, contextIsolation:true, sandbox:true}}};
    }
    external(url); return {action:'deny'};
  });
  window.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(window, {type:'question', buttons:['Continuar editando','Sair mesmo assim'], defaultId:0, cancelId:0, message:'Há alterações pendentes.', detail:'Volte à ficha para salvar ou exportar suas alterações antes de sair.'});
    if (choice === 1) event.preventDefault();
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (main) { if (main.isMinimized()) main.restore(); main.show(); main.focus(); } });
  app.whenReady().then(async () => {
    const directory = app.isPackaged ? join(process.resourcesPath, 'site') : process.env.FICHA_DESKTOP_SITE;
    if (!directory) throw Error('Execute npm run desktop:dev para preparar os arquivos públicos.');
    await protocol.handle('ficha', await createPublicHandler(directory));
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-attach-webview', event => event.preventDefault());
    });
    main = new BrowserWindow({width:1360, height:900, minWidth:360, minHeight:480, show:false,
      title:'Ficha RPG', icon:join(directory,'assets/app/icon-512.png'), backgroundColor:'#1c1f27',
      webPreferences:{nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true},
    });
    protect(main);
    main.webContents.on('did-create-window', (child, details) => protect(child, details.url));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Arquivo', submenu:[{label:'Imprimir', accelerator:'CmdOrCtrl+P', click:()=>main.webContents.print({silent:false, printBackground:true})}, {type:'separator'}, {role:'quit', label:'Sair'}]},
      {label:'Editar', submenu:[{role:'undo',label:'Desfazer'},{role:'redo',label:'Refazer'},{type:'separator'},{role:'cut',label:'Recortar'},{role:'copy',label:'Copiar'},{role:'paste',label:'Colar'},{role:'selectAll',label:'Selecionar tudo'}]},
      {label:'Exibir', submenu:[{role:'reload',label:'Reabrir ficha'},{role:'resetZoom',label:'Zoom original'},{role:'zoomIn',label:'Aumentar'},{role:'zoomOut',label:'Diminuir'},{role:'togglefullscreen',label:'Tela cheia'}]},
      {label:'Ajuda', submenu:[{label:'Abrir pasta de dados',click:()=>shell.openPath(profile)},{label:'Sobre',click:()=>dialog.showMessageBox(main,{message:`Ficha RPG ${app.getVersion()}`,detail:'Uso não comercial com atribuição. Consulte LICENSE e THIRD_PARTY_NOTICES.md na pasta resources/site da aplicação. Use o gerador para preparar uma versão nova.'})}]},
    ]));
    main.once('ready-to-show', () => main.show());
    await main.loadURL(`${APP_ORIGIN}/index.html`);
  }).catch(error => { dialog.showErrorBox('Não foi possível abrir o Ficha RPG', error.message); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
