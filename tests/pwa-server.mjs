// Origem isolada com releases em memória: não altera o SW ou arquivos do checkout.
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { buildOffline } from '../scripts/build-offline.mjs';

export async function startPwaServer({ prefix = '/ficha/', liveReload = null, fiveServer = false } = {}) {
  let release = await buildOffline({ write: false });
  const failures = new Map();
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png',
    '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) || 'index.html' : fiveServer && pathname === '/fiveserver.js' ? 'fiveserver.js' : null;
    let content = path === 'sw.js' ? release.source : release.files.get(path);
    if (path === 'docs/private/fixture.txt') content = 'Conteúdo privado fictício; não deve entrar no cache.';
    if (fiveServer && path === 'fiveserver.js') content = 'window.fixtureFiveServer = true;';
    if (failures.has(path)) { response.writeHead(503).end('Falha simulada'); return; }
    if (content === undefined) { response.writeHead(404).end('Não encontrado'); return; }
    // Bloco fictício com o envelope do Live Server, inserido como no servidor real.
    if (liveReload !== null && /\.(html|svg)$/.test(path)) {
      const injection = `<!-- Code injected by live-server -->\n<script type="text/javascript">window.fixtureLiveReload = true;</script>${liveReload}`;
      content = content.toString().replace(/<\/body>|<\/svg>|<\/head>/i, tag => injection + tag);
    }
    if (fiveServer && path.endsWith('.html')) {
      const injection = '<!-- Code injected by Five-server -->\n  <script async data-id="five-server" data-file="/fixture/index.html" type="application/javascript" src="/fiveserver.js"></script>\n  ';
      content = content.toString().replace(/<\/head>/i, tag => injection + tag);
    }
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'text/plain', 'Cache-Control': 'no-store' });
    response.end(content);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    get release() { return release; }, failures,
    async next(overrides) { release = await buildOffline({ write: false, overrides }); return release; },
    async close() { await new Promise(resolve => server.close(resolve)); },
  };
}
