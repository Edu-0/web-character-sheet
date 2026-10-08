import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
async function walk(directory, extension) {
  const paths = [];
  for (const entry of await readdir(new URL(`${directory}/`, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await walk(path, extension));
    else if (entry.name.endsWith(extension)) paths.push(path);
  }
  return paths;
}

export async function buildOffline({ write = true, check = false, overrides = new Map() } = {}) {
  const template = await readFile(new URL('scripts/service-worker.template.js', root), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('data/systems/index.json', root), 'utf8'));
  const paths = new Set(['index.html', 'manifest.webmanifest', 'data/systems/index.json',
    'assets/app/icon.svg', 'assets/app/icon-180.png', 'assets/app/icon-192.png', 'assets/app/icon-512.png',
    'assets/artwork/ornaments.js', 'assets/artwork/book-vectors.js', 'js/editor/generated/preview.css',
    ...await walk('css', '.css'), ...await walk('js', '.js')]);
  paths.delete('js/engine-test.js'); paths.delete('js/dice-pool-test.js');
  for (const entry of manifest.systems) for (const ref of [entry.system, ...entry.layouts.map(layout => layout.file)]) {
    const path = new URL(ref, new URL('data/systems/index.json', root)).href.slice(root.href.length);
    if (!path.startsWith('data/systems/') || !path.endsWith('.json') || path.includes('..')) throw new Error('Referência fora dos sistemas públicos.');
    paths.add(path);
  }
  const files = new Map();
  for (const path of [...paths].sort()) files.set(path, overrides.get(path) ?? await readFile(new URL(path, root)));
  const assets = [...files].map(([path, content]) => ({ path, hash: hash(content) }));
  const version = hash(JSON.stringify(assets) + template).slice(0, 20);
  const source = template.replace('__VERSION__', JSON.stringify(version)).replace('__ASSETS__', JSON.stringify(assets, null, 2));
  const current = await readFile(new URL('sw.js', root), 'utf8').catch(() => '');
  if (check && current !== source) throw new Error('sw.js está desatualizado. Execute npm run build:offline.');
  if (write && !check && current !== source) await writeFile(new URL('sw.js', root), source);
  return { source, version, assets, files };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildOffline({ check: process.argv.includes('--check') });
  console.log(`${result.assets.length} arquivos públicos; versão offline ${result.version}.`);
}
