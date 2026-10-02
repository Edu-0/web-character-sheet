// Links de Markdown versionado (e novos arquivos não ignorados).
// Além de existir, o destino precisa fazer parte do clone, sem depender de output/.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateMode = process.argv.includes('--private');
const files = new Set(execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean));
const errors = [];
let links = 0;
const check = (source, destination, offset, content) => {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(destination)) return;
  links++;
  let path;
  try { path = decodeURIComponent(destination.split(/[?#]/)[0]); }
  catch { errors.push(`${source}: URL inválida: ${destination}`); return; }
  const absolute = path.startsWith('/') ? resolve(root, `.${path}`) : resolve(root, dirname(source), path);
  const internal = relative(root, absolute).split(sep).join('/');
  const line = content.slice(0, offset).split('\n').length;
  if (internal.startsWith('../') || !existsSync(absolute) || (!privateMode && !files.has(internal))) errors.push(`${source}:${line}: destino ausente ${privateMode ? 'do workspace' : 'do repositório'}: ${destination}`);
};
const markdown = privateMode
  ? readdirSync(resolve(root, 'docs/private')).filter(file => file.endsWith('.md')).map(file => `docs/private/${file}`).sort()
  : [...files].filter(file => file.endsWith('.md') && existsSync(resolve(root, file))).sort();
for (const source of markdown) {
  const content = readFileSync(resolve(root, source), 'utf8');
  // Conserva offsets/linhas, ignorando exemplos em blocos de código.
  const prose = content.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/g, value => value.replace(/[^\n]/g, ' '));
  const definitions = new Map();
  for (const match of prose.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
    definitions.set(match[1].trim().toLowerCase(), match[2] || match[3]);
    check(source, match[2] || match[3], match.index, content);
  }
  for (const match of prose.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g)) check(source, match[1] || match[2], match.index, content);
  for (const match of prose.matchAll(/!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g)) {
    const key = (match[2] || match[1]).trim().toLowerCase();
    if (!definitions.has(key)) errors.push(`${source}: referência Markdown indefinida: ${key}`);
  }
  for (const match of prose.matchAll(/<(?:a|img)\b[^>]*?\b(?:href|src)=["']([^"']+)["'][^>]*>/gi)) check(source, match[1], match.index, content);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`${markdown.length} documentos; ${links} links internos válidos. ${privateMode ? 'Memória privada conferida somente neste workspace.' : 'Destinos presentes no clone.'} Âncoras e URLs externas não verificados.`);
