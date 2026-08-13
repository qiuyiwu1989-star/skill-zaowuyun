import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_ROOT = path.resolve(ROOT, '../public');
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const MAX_LISTINGS = 1000;
const STAGES = new Set(['indexed', 'callable', 'certified']);

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

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} keys are invalid`);
}

function boundedText(value, { max = 500, pattern } = {}) {
  return typeof value === 'string' && value.length > 0 && value.length <= max && (!pattern || pattern.test(value));
}

function validateListing(value) {
  exactKeys(value, ['category', 'descriptionZh', 'distribution', 'install', 'invocation', 'license', 'originalName', 'skillId', 'slug', 'source', 'stage', 'tags', 'titleZh', 'trust', 'version'], 'listing');
  if (!boundedText(value.skillId, { max: 100, pattern: /^[a-z0-9-]+\/[a-z0-9-]+$/ })) throw new Error('skillId is invalid');
  if (!boundedText(value.slug, { max: 64, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ })) throw new Error('slug is invalid');
  for (const field of ['titleZh', 'originalName', 'descriptionZh', 'category', 'version']) {
    if (!boundedText(value[field], { max: field === 'descriptionZh' ? 500 : 100 })) throw new Error(`${field} is invalid`);
  }
  if (!STAGES.has(value.stage) || !['source_only', 'content'].includes(value.distribution)) throw new Error('listing stage is invalid');
  if (!Array.isArray(value.tags) || value.tags.length > 12 || value.tags.some((tag) => !boundedText(tag, { max: 40 }))) throw new Error('tags are invalid');

  exactKeys(value.license, ['label', 'status'], 'license');
  if (!['owner_authorized_use', 'redistributable', 'unclear'].includes(value.license.status) || !boundedText(value.license.label, { max: 120 })) throw new Error('license is invalid');
  exactKeys(value.trust, ['evalStatus', 'packageAudit', 'reviewStatus', 'smsScore', 'smsTier'], 'trust');
  if (!['pass', 'pending'].includes(value.trust.packageAudit) || !['pass', 'pending'].includes(value.trust.evalStatus) || !['certified', 'pending'].includes(value.trust.reviewStatus)) throw new Error('trust status is invalid');
  if (!Number.isInteger(value.trust.smsScore) || value.trust.smsScore < 0 || value.trust.smsScore > 100 || !/^[A-D]$/.test(value.trust.smsTier)) throw new Error('SMS is invalid');

  exactKeys(value.invocation, ['examples', 'mode', 'text'], 'invocation');
  if (value.invocation.mode !== 'copy_text' || !boundedText(value.invocation.text, { max: 500 })) throw new Error('invocation is invalid');
  if (!Array.isArray(value.invocation.examples) || value.invocation.examples.length > 6 || value.invocation.examples.some((example) => !boundedText(example, { max: 160 }))) throw new Error('invocation examples are invalid');
  exactKeys(value.source, ['label', 'revision'], 'source');
  if (!boundedText(value.source.label, { max: 80 }) || !boundedText(value.source.revision, { max: 64, pattern: /^[0-9a-f]{7,64}$/ })) throw new Error('source is invalid');
  exactKeys(value.install, ['eligible', 'reason'], 'install');
  if (typeof value.install.eligible !== 'boolean' || !boundedText(value.install.reason, { max: 100, pattern: /^[a-z_]+$/ })) throw new Error('install is invalid');
  if (value.stage === 'callable' && value.trust.packageAudit !== 'pass') throw new Error('callable listing must pass package audit');
  if (value.stage === 'certified') {
    const eligible = value.distribution === 'content'
      && value.license.status === 'redistributable'
      && value.trust.packageAudit === 'pass'
      && value.trust.evalStatus === 'pass'
      && value.trust.reviewStatus === 'certified';
    if (!eligible) throw new Error('certified listing evidence is incomplete');
  }
  if (value.stage !== 'certified' && value.install.eligible) throw new Error('uncertified listing cannot be installable');
  return value;
}

function validateCatalog(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('catalog must be an object');
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['generatedAt', 'listings', 'schemaVersion'])) throw new Error('catalog keys are invalid');
  if (value.schemaVersion !== 1 || !Array.isArray(value.listings) || value.listings.length > MAX_LISTINGS) throw new Error('catalog schema is invalid');
  if (value.generatedAt !== null && (typeof value.generatedAt !== 'string' || !Number.isFinite(Date.parse(value.generatedAt)))) {
    throw new Error('catalog generatedAt is invalid');
  }
  value.listings.forEach(validateListing);
  const slugs = value.listings.map((listing) => listing.slug);
  const ids = value.listings.map((listing) => listing.skillId);
  if (new Set(slugs).size !== slugs.length || new Set(ids).size !== ids.length) throw new Error('catalog identities are duplicated');
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
  if (/^\/skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(decoded)) return path.resolve(publicRoot, 'skill.html');
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
