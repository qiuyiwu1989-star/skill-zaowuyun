import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAppServer, listen } from '../src/server.mjs';

async function fixture(catalog = { schemaVersion: 1, generatedAt: null, listings: [] }) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'skill-zaowuyun-'));
  await mkdir(path.join(root, 'data'));
  await writeFile(path.join(root, 'index.html'), '<h1>造物云</h1>');
  await writeFile(path.join(root, 'skill.html'), '<h1>技能详情</h1>');
  await writeFile(path.join(root, 'data/listings.json'), JSON.stringify(catalog));
  return root;
}

async function withServer(publicRoot, run) {
  const server = createAppServer({ publicRoot, version: 'test-revision' });
  const address = await listen(server, { port: 0 });
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('health and ready endpoints expose bounded production status', async () => {
  await withServer(await fixture(), async (base) => {
    const health = await fetch(`${base}/healthz`).then((response) => response.json());
    assert.deepEqual(health, { status: 'ok', service: 'skill-zaowuyun', version: 'test-revision' });
    const readyResponse = await fetch(`${base}/readyz`);
    assert.equal(readyResponse.status, 200);
    assert.deepEqual(await readyResponse.json(), { status: 'ready', listings: 0, version: 'test-revision' });
  });
});

test('catalog endpoint only returns a fixed valid public schema', async () => {
  await withServer(await fixture({ schemaVersion: 1, generatedAt: '2026-08-13T00:00:00.000Z', listings: [] }), async (base) => {
    const response = await fetch(`${base}/api/v1/catalog`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await response.json()).schemaVersion, 1);
  });

  await withServer(await fixture({ schemaVersion: 1, generatedAt: null, listings: [], secret: 'forbidden' }), async (base) => {
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
    assert.equal((await fetch(`${base}/api/v1/catalog`)).status, 503);
  });
});

test('tiered catalog accepts safe callable entries and rejects misleading installation', async () => {
  const listing = {
    skillId: 'qiuyiwu/example-skill', slug: 'example-skill', titleZh: '示例技能', originalName: 'example-skill',
    descriptionZh: '用于验证公开目录契约。', category: '产品与研发', tags: ['需求分析'], version: 'abcdef0',
    stage: 'callable', distribution: 'source_only',
    creator: { displayName: '造物云', handle: 'zaowuyun', kind: 'organization', verification: '来源已核验' },
    offer: { model: 'free', priceLabel: '免费体验', rightsLabel: '在线体验', acquisitionLabel: '进入工作台体验', note: '正式授权待发布' },
    license: { status: 'owner_authorized_use', label: '允许平台调用，分发授权待补齐' },
    trust: { packageAudit: 'pass', smsScore: 60, smsTier: 'C', evalStatus: 'pending', reviewStatus: 'pending' },
    invocation: { mode: 'copy_text', text: '请使用示例技能处理下面的任务：', examples: ['整理这个需求'] },
    source: { label: '造物云自有技能', revision: 'abcdef0' },
    install: { eligible: false, reason: 'redistribution_license_pending' }
  };
  await withServer(await fixture({ schemaVersion: 1, generatedAt: '2026-08-14T00:00:00.000Z', listings: [listing] }), async (base) => {
    const response = await fetch(`${base}/api/v1/catalog`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).listings[0].stage, 'callable');
  });

  const misleading = structuredClone(listing);
  misleading.install.eligible = true;
  await withServer(await fixture({ schemaVersion: 1, generatedAt: null, listings: [misleading] }), async (base) => {
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
  });

  const fakeCertification = structuredClone(listing);
  fakeCertification.stage = 'certified';
  await withServer(await fixture({ schemaVersion: 1, generatedAt: null, listings: [fakeCertification] }), async (base) => {
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
  });
});

test('static delivery supports GET and HEAD and blocks mutation methods', async () => {
  await withServer(await fixture(), async (base) => {
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /造物云/);
    assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

    const head = await fetch(`${base}/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    const post = await fetch(`${base}/api/v1/catalog`, { method: 'POST' });
    assert.equal(post.status, 405);

    const detail = await fetch(`${base}/skills/example-skill/`);
    assert.equal(detail.status, 200);
    assert.match(await detail.text(), /技能详情/);
  });
});

test('path traversal and missing files fail closed', async () => {
  const root = await fixture();
  await symlink('/etc/passwd', path.join(root, 'linked-secret'));
  await withServer(root, async (base) => {
    assert.equal((await fetch(`${base}/..%2F..%2Fetc%2Fpasswd`)).status, 400);
    assert.equal((await fetch(`${base}/linked-secret`)).status, 404);
    assert.equal((await fetch(`${base}/missing.txt`)).status, 404);
  });
});
