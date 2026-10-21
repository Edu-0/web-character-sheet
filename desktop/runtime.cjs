const {readFile} = require('node:fs/promises');
const {join} = require('node:path');

const APP_ORIGIN = 'ficha://app';
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.svg':'image/svg+xml', '.png':'image/png', '.md':'text/plain', '.ico':'image/x-icon'};

function publicPath(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'ficha:' || url.hostname !== 'app' || url.port || url.username || url.password) return null;
    const path = decodeURIComponent(url.pathname).slice(1) || 'index.html';
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => !part || part === '.' || part === '..')) return null;
    return path;
  } catch { return null; }
}

async function createPublicHandler(directory) {
  const info = JSON.parse(await readFile(join(directory, 'build-info.json'), 'utf8'));
  const allowed = new Set([...info.assets.map(asset => asset.path), ...info.guides, 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'assets/artwork/README.md', 'build-info.json']);
  // No service worker: every launch reads the complete installed snapshot.
  allowed.delete('sw.js');
  return async request => {
    const path = publicPath(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status:405});
    if (!path || !allowed.has(path)) return new Response(null, {status:404});
    try {
      const body = await readFile(join(directory, path));
      const extension = path.slice(path.lastIndexOf('.'));
      return new Response(request.method === 'HEAD' ? null : body, {headers:{
        'Content-Type': (types[extension] || 'text/plain') + (['.png','.ico'].includes(extension) ? '' : '; charset=utf-8'),
        'Content-Security-Policy': CSP,
        'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store',
      }});
    } catch { return new Response(null, {status:404}); }
  };
}

module.exports = {APP_ORIGIN, publicPath, createPublicHandler};
