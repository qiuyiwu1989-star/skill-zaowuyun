import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('market page follows Zaowuyun design tokens and Chinese enterprise IA', async () => {
  const [html, css, app] = await Promise.all([
    readFile(path.join(root, 'public/index.html'), 'utf8'),
    readFile(path.join(root, 'public/styles.css'), 'utf8'),
    readFile(path.join(root, 'public/app.js'), 'utf8')
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
  assert.match(html, /未经完整包/);
  assert.match(app, /当前均不可安装/);
});

test('public UI contains no forbidden dash typography or candidate identifiers', async () => {
  const files = await Promise.all(['index.html', 'styles.css', 'app.js'].map((name) => readFile(path.join(root, 'public', name), 'utf8')));
  const publicSource = files.join('\n');
  assert.doesNotMatch(publicSource, /[—–]/u);
  assert.doesNotMatch(publicSource, /cand_[0-9a-f]+/u);
  assert.doesNotMatch(publicSource, /storageRef|reviewerPrincipal|prompt|output|token/iu);
});
