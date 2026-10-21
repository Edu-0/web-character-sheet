module.exports = {
  appId:'br.ficharpg.desktop', productName:'Ficha RPG', executableName:'Ficha RPG',
  asar:true, npmRebuild:false,
  files:['desktop/main.cjs','desktop/runtime.cjs','package.json'],
  win:{target:[{target:'portable',arch:['x64']},{target:'nsis',arch:['x64']}], icon:'assets/app/icon-512.png', signExecutable:false},
  portable:{artifactName:'Ficha-RPG-${version}-portable-${arch}.${ext}', requestExecutionLevel:'user'},
  nsis:{artifactName:'Ficha-RPG-${version}-instalador-${arch}.${ext}', oneClick:false, perMachine:false, allowElevation:false, allowToChangeInstallationDirectory:true, deleteAppDataOnUninstall:false, runAfterFinish:false, installerLanguages:['pt_BR'], language:'1046'},
};
