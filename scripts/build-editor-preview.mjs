import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,relative,isAbsolute} from 'node:path';
const root=new URL('../',import.meta.url);
export async function buildEditorPreview({check=false}={}) {
  const directory=fileURLToPath(root);
  const localModules={name:'local-preview-graph',setup(api){
    api.onResolve({filter:/.*/},args=>{
      if (!args.path.startsWith('.')) throw new Error(`Import não local: ${args.path}`);
      const absolute=resolve(args.resolveDir || directory,args.path), path=relative(directory,absolute).replaceAll('\\','/');
      if(path.startsWith('../') || isAbsolute(path) || !/^(js|assets)\/.+\.js$/.test(path)) throw new Error(`Import fora do runtime: ${path}`);
      return {path,namespace:'preview-local'};
    });
    api.onLoad({filter:/.*/,namespace:'preview-local'},async args=>({contents:await readFile(resolve(directory,args.path),'utf8'),loader:'js',resolveDir:resolve(directory,args.path,'..')}));
  }};
  const result=await build({absWorkingDir:directory,entryPoints:['./js/editor/preview-entry.js'],plugins:[localModules],tsconfigRaw:{},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',minify:true,metafile:true,sourcemap:false,legalComments:'inline'});
  const forbidden=/^(?:js\/(?:app(?:-state)?|state|storage|persistence|pwa|theme|appearance|artwork|library-backup|backup-controls|character-history(?:-controls)?|sheet-search|printing|ui)\.js|js\/repositories\/|docs\/)/;
  for (const [path,entry] of Object.entries(result.metafile.inputs)) {
    if (forbidden.test(path.replace(/^preview-local:/,''))) throw new Error(`Import proibido no ensaio: ${path}`);
    if (entry.imports.some(item=>item.external)) throw new Error(`Dependência externa no ensaio: ${path}`);
  }
  const paths=['variables','base','components','engine','character-sheet','artwork','refinement'];
  const css=(await Promise.all(paths.map(name=>readFile(new URL(`css/${name}.css`,root),'utf8')))).join('\n')+'\nbody{padding:16px}#preview-sheet{min-width:0}.modal-overlay[hidden]{display:none}';
  if (/@import|url\(\s*['"]?https?:/i.test(css)) throw new Error('CSS de prévia tem rede externa.');
  const outputs=new Map([['preview.js',result.outputFiles[0].text],['preview.css',css]]);
  await mkdir(new URL('js/editor/generated/',root),{recursive:true});
  for(const [name,source] of outputs) {
    const url=new URL(`js/editor/generated/${name}`,root), current=await readFile(url,'utf8').catch(()=>null);
    if(check && current!==source) throw new Error(`Prévia desatualizada: ${name}`);
    if(!check && current!==source) await writeFile(url,source);
  }
  return {bytes:result.outputFiles[0].contents.length,cssBytes:Buffer.byteLength(css),inputs:Object.keys(result.metafile.inputs).length};
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) console.log(await buildEditorPreview({check:process.argv.includes('--check')}));
