import {mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildOffline} from './build-offline.mjs';

const root=new URL('../',import.meta.url);

// Copy the offline builder's explicit public snapshot, never a repository tree.
// Each build gets a new directory; existing exports and user files are untouched.
export async function buildSite({parent=fileURLToPath(new URL('output/',root))}={}) {
  const release=await buildOffline({write:false});
  const {version}=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  const files=new Map(release.files);
  files.set('sw.js',release.source);
  // The editor links to these public guides; private docs are never traversed.
  const guides=[];
  for(const entry of await readdir(new URL('data/examples/',root),{withFileTypes:true}))if(entry.isFile()){
    const path='data/examples/'+entry.name;guides.push(path);files.set(path,await readFile(new URL(path,root)));
  }
  for(const name of ['LICENSE','THIRD_PARTY_NOTICES.md','assets/artwork/README.md'])files.set(name,await readFile(new URL(name,root)));
  files.set('build-info.json',JSON.stringify({version,offlineVersion:release.version,assets:release.assets,guides},null,2)+'\n');
  await mkdir(parent,{recursive:true});
  const directory=await mkdtemp(join(parent,`ficha-rpg-${version}-`));
  for(const [path,content] of files){
    const target=join(directory,path);
    await mkdir(dirname(target),{recursive:true});await writeFile(target,content);
  }
  return {directory,version,offlineVersion:release.version,count:files.size};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(await buildSite(),null,2));
