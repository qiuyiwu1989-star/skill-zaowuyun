const main = document.querySelector('#detail-main');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function slugFromPath() {
  const match = location.pathname.match(/^\/skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  return match?.[1] || '';
}

async function copyText(button, text) {
  button.textContent = '已复制，现在去调用';
  button.dataset.copied = 'true';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = element('textarea', 'clipboard-fallback');
    area.value = text;
    area.setAttribute('readonly', '');
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function stageLabel(stage) {
  if (stage === 'certified') return '企业认证';
  if (stage === 'callable') return '可快速调用';
  return '已收录';
}

function statusLabel(status, passText, pendingText) {
  return status === 'pass' || status === 'certified' ? passText : pendingText;
}

function render(listing) {
  document.title = `${listing.titleZh}｜造物云技能市场`;
  const shell = element('div', 'detail-shell');

  const hero = element('section', 'detail-hero');
  const copy = element('div', 'detail-hero-copy');
  const badges = element('div', 'detail-badges');
  badges.append(element('span', 'skill-category', listing.category), element('span', 'distribution-badge', stageLabel(listing.stage)));
  copy.append(
    badges,
    element('h1', '', listing.titleZh),
    element('p', 'detail-original', listing.originalName),
    element('p', 'detail-description', listing.descriptionZh)
  );

  const snapshot = element('aside', 'detail-snapshot');
  const snapshotTitle = element('strong', '', '当前使用边界');
  const snapshotText = element('p', '', listing.install.eligible
    ? '已满足完整包分发和企业安装门禁。'
    : '可以复制调用词使用，但暂不提供技能包下载或一键安装。');
  snapshot.append(snapshotTitle, snapshotText, element('span', 'snapshot-revision', `固定版本 ${listing.source.revision}`));
  hero.append(copy, snapshot);

  const invoke = element('section', 'detail-section invoke-panel');
  invoke.id = 'invoke';
  const invokeCopy = element('div');
  invokeCopy.append(element('p', 'eyebrow', '快速调用'), element('h2', '', '复制这句话，直接交给你的 AI 助手'));
  const invocation = element('code', 'invocation-text', listing.invocation.text);
  const button = element('button', 'button button-primary detail-invoke', '复制调用词');
  button.type = 'button';
  button.addEventListener('click', () => copyText(button, listing.invocation.text));
  const examples = element('div', 'invoke-examples');
  examples.append(element('strong', '', '可以这样继续描述任务'));
  const list = element('ul');
  for (const example of listing.invocation.examples) list.append(element('li', '', example));
  examples.append(list);
  invoke.append(invokeCopy, invocation, button, examples);

  const evidence = element('section', 'detail-section');
  evidence.id = 'evidence';
  evidence.append(element('p', 'eyebrow', '可信证据'), element('h2', '', '证据公开，状态分开判断'));
  const grid = element('div', 'evidence-grid');
  const items = [
    ['完整包安全', statusLabel(listing.trust.packageAudit, '扫描通过', '待扫描'), '已检查技能说明、脚本、引用与资产。'],
    ['SMS 静态潜力', `${listing.trust.smsScore} 分 · ${listing.trust.smsTier} 段`, '反映结构与复用潜力，不代表运行效果。'],
    ['Eval 运行实绩', statusLabel(listing.trust.evalStatus, '已有实证', '待实证',), '没有实证时不展示虚假的成功率。'],
    ['人类终审', statusLabel(listing.trust.reviewStatus, '双人通过', '待双人终审'), '进入企业生产前需要两个独立可信身份终审。']
  ];
  for (const [label, value, note] of items) {
    const card = element('article', 'evidence-card');
    card.append(element('span', '', label), element('strong', '', value), element('p', '', note));
    grid.append(card);
  }
  evidence.append(grid);

  const boundary = element('section', 'detail-section boundary-panel');
  boundary.append(element('p', 'eyebrow', '许可与分发'), element('h2', '', '调用授权与技能包分发不是一回事'));
  const boundaryGrid = element('div', 'boundary-grid');
  const allowed = element('div');
  allowed.append(element('strong', '', '现在可以做'), element('p', '', '浏览公开说明、复制调用词，并在你已有的 AI 工作环境中发起任务。'));
  const restricted = element('div');
  restricted.append(element('strong', '', '现在不能做'), element('p', '', `${listing.license.label}，因此市场不复制技能包，也不提供一键安装。`));
  boundaryGrid.append(allowed, restricted);
  boundary.append(boundaryGrid);

  shell.append(hero, invoke, evidence, boundary);
  main.replaceChildren(shell);
  main.setAttribute('aria-busy', 'false');
}

function renderError() {
  const error = element('div', 'detail-error');
  error.append(element('h1', '', '没有找到这个技能'), element('p', '', '它可能尚未收录，或公开状态已经发生变化。'));
  const link = element('a', 'button button-primary', '返回能力市场');
  link.href = '/';
  error.append(link);
  main.replaceChildren(error);
  main.setAttribute('aria-busy', 'false');
}

try {
  const response = await fetch('/api/v1/catalog', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('catalog unavailable');
  const catalog = await response.json();
  const listing = catalog.listings?.find((item) => item.slug === slugFromPath());
  if (!listing) throw new Error('skill unavailable');
  render(listing);
} catch {
  renderError();
}
