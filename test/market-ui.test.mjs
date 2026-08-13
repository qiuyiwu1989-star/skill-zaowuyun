import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('market page follows Zaowuyun design tokens and Chinese enterprise IA', async () => {
  const [html, css, app, detailHtml, detailJs, detailCss] = await Promise.all([
    readFile(path.join(root, 'public/index.html'), 'utf8'),
    readFile(path.join(root, 'public/styles.css'), 'utf8'),
    readFile(path.join(root, 'public/app.js'), 'utf8'),
    readFile(path.join(root, 'public/skill.html'), 'utf8'),
    readFile(path.join(root, 'public/skill.js'), 'utf8'),
    readFile(path.join(root, 'public/skill.css'), 'utf8')
  ]);

  assert.match(html, /造物云技能市场/);
  assert.match(html, /按任务选择技能/);
  assert.match(html, /场景分类/);
  assert.match(html, /可信准入/);
  assert.match(html, /发布技能/);
  assert.match(html, /id="catalog-search-input"/);
  assert.match(html, /id="distribution-filter"/);
  assert.match(html, /zaowuyun-mark-color\.svg/);
  assert.match(css, /--accent: #5a4fe6/);
  assert.match(css, /--accent: #7b80ff/);
  assert.match(css, /--radius-xl: 22px/);
  assert.match(css, /max-width: 680px/);
  assert.match(html, /可调用不等于可安装/);
  assert.match(html, /可快速调用/);
  assert.match(app, /复制调用词/);
  assert.match(detailHtml, /快速调用/);
  assert.match(detailJs, /调用授权与技能包分发不是一回事/);
  assert.match(detailCss, /evidence-grid/);
});

test('public UI contains no forbidden dash typography or candidate identifiers', async () => {
  const files = await Promise.all(['index.html', 'styles.css', 'app.js', 'skill.html', 'skill.css', 'skill.js'].map((name) => readFile(path.join(root, 'public', name), 'utf8')));
  const publicSource = files.join('\n');
  assert.doesNotMatch(publicSource, /[—–]/u);
  assert.doesNotMatch(publicSource, /cand_[0-9a-f]+/u);
  assert.doesNotMatch(publicSource, /storageRef|reviewerPrincipal|prompt|output|token/iu);
});

test('first catalog batch is callable, evidence-backed and not installable', async () => {
  const catalog = JSON.parse(await readFile(path.join(root, 'public/data/listings.json'), 'utf8'));
  assert.equal(catalog.listings.length, 3);
  assert.deepEqual(catalog.listings.map((listing) => listing.titleZh).sort(), ['判断库架构', '生产事故快诊', '需求简报器']);
  for (const listing of catalog.listings) {
    assert.equal(listing.stage, 'callable');
    assert.equal(listing.distribution, 'source_only');
    assert.equal(listing.install.eligible, false);
    assert.equal(listing.trust.packageAudit, 'pass');
    assert.equal(listing.trust.evalStatus, 'pending');
    assert.match(listing.invocation.text, /^请使用/);
    assert.doesNotMatch(JSON.stringify(listing), /cand_[0-9a-f]+|storageRef|principal/iu);
  }
});
