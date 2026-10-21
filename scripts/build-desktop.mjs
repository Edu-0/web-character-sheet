import {buildSite} from './build-site.mjs';
import {buildEditorPreview} from './build-editor-preview.mjs';
import {build, Platform, Arch} from 'electron-builder';
import {mkdir, mkdtemp, readFile, writeFile, copyFile} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const config = require('../desktop/builder-config.cjs');
const dev = process.argv.includes('--dev');
await buildEditorPreview();
const site = await buildSite();
if (dev) {
  const env = {...process.env, FICHA_DESKTOP_SITE:site.directory, FICHA_DESKTOP_TEST_PROFILE:process.env.FICHA_DESKTOP_TEST_PROFILE || join(root,'tmp/desktop-dev-profile')}; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [root], {cwd:root, stdio:'inherit', env});
  child.on('error', error => { console.error(error); process.exitCode=1; });
  child.on('exit', code => { process.exitCode=code ?? 1; });
} else {
  if (process.platform !== 'win32') throw Error('Gere os executáveis Windows em um Windows x64.');
  const parent = resolve(root, 'output/desktop'); await mkdir(parent, {recursive:true});
  const directory = await mkdtemp(join(parent,`ficha-rpg-${site.version}-`));
  const paths = await build({targets:Platform.WINDOWS.createTarget(process.argv.includes('--dir') ? ['dir'] : ['portable','nsis'], Arch.x64), publish:'never',
    config:{...config, electronDist:dirname(require('electron')), directories:{output:directory}, extraResources:[{from:site.directory,to:'site',filter:['**/*']}]},
  });
  if (!process.argv.includes('--dir')) {
    const {buildGenerator} = await import('./build-generator.mjs');
    paths.push(await buildGenerator({directory}));
    await copyFile(join(root,'desktop/LEIA-ME.txt'), join(directory,'LEIA-ME.txt'));
    const sums=[];
    for (const path of paths.filter(path=>path.endsWith('.exe'))) sums.push(`${createHash('sha256').update(await readFile(path)).digest('hex')}  ${path.split(/[\\/]/).at(-1)}`);
    await writeFile(join(directory,'SHA256SUMS.txt'), sums.join('\n')+'\n');
  }
  await writeFile(join(directory,'desktop-build.json'), JSON.stringify({version:site.version,offlineVersion:site.offlineVersion,artifacts:paths.map(path=>path.split(/[\\/]/).at(-1))},null,2)+'\n');
  console.log(`\nExecutáveis em: ${directory}`);
}
