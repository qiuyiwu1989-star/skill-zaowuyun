import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_ROOT = path.resolve(ROOT, '../public');
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

function send(res, statusCode, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Cache-Control': 'no-store',
    'Content-Length': payload.length,
    ...headers
  });
  res.end(payload);
}

function sendJson(res, statusCode, value) {
  send(res, statusCode, `${JSON.stringify(value)}\n`, {
    'Content-Type': 'application/json; charset=utf-8'
  });
}

function validateCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('catalog must be an object');
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['generatedAt', 'listings', 'schemaVersion'])) throw new Error('catalog keys are invalid');
  if (value.schemaVersion !== 1 || !Array.isArray(value.listings)) throw new Error('catalog schema is invalid');
  if (value.generatedAt !== null && (typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)))) {
    throw new Error('catalog generatedAt is invalid');
  }
  return value;
}

async function loadCatalog(publicRoot) {
  const canonicalRoot = await realpath(publicRoot);
  const catalogPath = await realpath(path.join(publicRoot, 'data/listings.json'));
  if (!catalogPath.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error('catalog path is invalid');
  const info = await stat(catalogPath);
  if (!info.isFile() || info.size > MAX_CATALOG_BYTES) throw new Error('catalog file is invalid');
  return validateCatalog(JSON.parse(await readFile(catalogPath, 'utf8')));
}

function resolvePublicPath(publicRoot, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(publicRoot, relative);
  const prefix = `${publicRoot}${path.sep}`;
  return candidate.startsWith(prefix) ? candidate : null;
}

export function createAppServer({ publicRoot = DEFAULT_PUBLIC_ROOT, version = process.env.APP_VERSION || 'dev' } = {}) {
  const absoluteRoot = path.resolve(publicRoot);
  return http.createServer(async (req, res) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/healthz') {
      sendJson(res, 200, { status: 'ok', service: 'skill-zaowuyun', version });
      return;
    }
    if (url.pathname === '/readyz') {
      try {
        const catalog = await loadCatalog(absoluteRoot);
        sendJson(res, 200, { status: 'ready', listings: catalog.listings.length, version });
      } catch {
        sendJson(res, 503, { status: 'not_ready', reason: 'catalog_invalid', version });
      }
      return;
    }
    if (url.pathname === '/api/v1/catalog') {
      try {
        sendJson(res, 200, await loadCatalog(absoluteRoot));
      } catch {
        sendJson(res, 503, { error: 'catalog_unavailable' });
      }
      return;
    }

    const filePath = resolvePublicPath(absoluteRoot, url.pathname);
    if (!filePath) {
      sendJson(res, 400, { error: 'invalid_path' });
      return;
    }
    try {
      const canonicalRoot = await realpath(absoluteRoot);
      const canonicalPath = await realpath(filePath);
      if (!canonicalPath.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error('path escapes public root');
      const info = await stat(canonicalPath);
      if (!info.isFile()) throw new Error('not a file');
      const body = method === 'HEAD' ? Buffer.alloc(0) : await readFile(canonicalPath);
      send(res, 200, body, {
        'Cache-Control': path.extname(canonicalPath) === '.html' ? 'no-cache' : 'public, max-age=300',
        'Content-Type': CONTENT_TYPES.get(path.extname(canonicalPath)) || 'application/octet-stream',
        ...(method === 'HEAD' ? { 'Content-Length': info.size } : {})
      });
    } catch {
      sendJson(res, 404, { error: 'not_found' });
    }
  });
}

export function listen(server, { host = '127.0.0.1', port = 4310 } = {}) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve(server.address());
    });
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const server = createAppServer();
  const host = process.env.HOST || '127.0.0.1';
  const port = Number.parseInt(process.env.PORT || '4310', 10);
  await listen(server, { host, port });
  process.stdout.write(`skill-zaowuyun listening on http://${host}:${port}\n`);
}
