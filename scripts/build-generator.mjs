import {mkdir,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const root = fileURLToPath(new URL('../',import.meta.url));
export async function buildGenerator({directory}={}) {
  if (process.platform !== 'win32') throw Error('Compile o gerador em Windows com .NET Framework 4.x.');
  if (!directory) {
    const parent=join(root,'output/generator');await mkdir(parent,{recursive:true});
    directory=await mkdtemp(join(parent,'ficha-'));
  }
  const executable=join(directory,'Gerar-Ficha-RPG.exe');
  const compiler=join(process.env.WINDIR || 'C:\\Windows','Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(compiler,['/nologo','/target:exe','/platform:anycpu','/optimize+',`/out:${executable}`,`/resource:${join(root,'desktop/generator/generate.ps1')},generate.ps1`,join(root,'desktop/generator/Generator.cs')],{cwd:root,stdio:'inherit'});
  return executable;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) console.log(await buildGenerator());
