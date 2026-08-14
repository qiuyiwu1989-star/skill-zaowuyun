const elements = {
  catalogContent: document.querySelector('#catalog-content'),
  catalogStatus: document.querySelector('#catalog-status'),
  categoryList: document.querySelector('#category-list'),
  categoryTotal: document.querySelector('#category-total'),
  distribution: document.querySelector('#distribution-filter'),
  filterSummary: document.querySelector('#filter-summary'),
  heroForm: document.querySelector('#hero-search'),
  heroInput: document.querySelector('#hero-search-input'),
  callableCount: document.querySelector('#callable-count'),
  certifiedCount: document.querySelector('#certified-count'),
  releaseCount: document.querySelector('#release-count'),
  searchInput: document.querySelector('#catalog-search-input'),
  shelfList: document.querySelector('#shelf-list'),
  sort: document.querySelector('#sort-select'),
  themeToggle: document.querySelector('#theme-toggle')
};

const state = {
  category: '全部技能',
  stage: 'all',
  keyword: '',
  listings: [],
  sort: 'recommended'
};

const fallbackCategories = ['全部技能', '产品与研发', '办公效率', '内容创作', '研发运维', '数据与知识'];

function safeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function safeUrl(value) {
  const url = safeText(value);
  if (!url) return '';
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function normalizeListing(listing) {
  const catalog = listing?.catalog && typeof listing.catalog === 'object' ? listing.catalog : {};
  const metadata = listing?.metadata && typeof listing.metadata === 'object' ? listing.metadata : {};
  const install = listing?.install && typeof listing.install === 'object' ? listing.install : {};
  const sms = listing?.sms && typeof listing.sms === 'object' ? listing.sms : {};
  const evaluation = listing?.eval && typeof listing.eval === 'object' ? listing.eval : {};
  const trust = listing?.trust && typeof listing.trust === 'object' ? listing.trust : {};
  const invocation = listing?.invocation && typeof listing.invocation === 'object' ? listing.invocation : {};
  const license = listing?.license && typeof listing.license === 'object' ? listing.license : {};
  const creator = listing?.creator && typeof listing.creator === 'object' ? listing.creator : {};
  const offer = listing?.offer && typeof listing.offer === 'object' ? listing.offer : {};
  const source = listing?.source && typeof listing.source === 'object' ? listing.source : {};
  const title = safeText(listing?.titleZh) || safeText(metadata.titleZh) || safeText(listing?.name) || '未命名技能';
  const originalName = safeText(listing?.originalName) || safeText(listing?.name) || safeText(metadata.originalName);
  const description = safeText(listing?.descriptionZh) || safeText(metadata.descriptionZh) || '已通过造物云可信准入的技能。';
  const category = safeText(listing?.category) || safeText(catalog.category) || '其他能力';
  const tags = Array.isArray(listing?.tags) ? listing.tags.map(safeText).filter(Boolean) : [];
  const installable = install.eligible === true;
  const slug = safeText(listing?.slug);
  const stage = ['indexed', 'callable', 'certified'].includes(listing?.stage) ? listing.stage : (installable ? 'certified' : 'indexed');
  return {
    category,
    creatorName: safeText(creator.displayName) || '开放技能生态',
    creatorVerification: safeText(creator.verification),
    description,
    detailUrl: slug ? `/skills/${slug}/` : safeUrl(listing?.canonicalUrl) || safeUrl(listing?.detailUrl),
    evalRate: number(evaluation.successRate),
    evalStatus: safeText(trust.evalStatus) || (evaluation.successRate ? 'pass' : 'pending'),
    installable,
    invocationText: safeText(invocation.text),
    licenseLabel: safeText(license.label),
    originalName,
    offerLabel: safeText(offer.priceLabel) || '联系授权',
    offerNote: safeText(offer.note),
    publishedAt: safeText(catalog.publishedAt) || safeText(listing?.publishedAt),
    reviewStatus: safeText(trust.reviewStatus) || 'pending',
    smsScore: number(trust.smsScore ?? sms.total ?? sms.score),
    smsTier: safeText(trust.smsTier),
    sourceUrl: safeUrl(source.url) || safeUrl(source.upstreamUrl),
    stage,
    tags,
    title,
    version: safeText(listing?.version) || '固定版本'
  };
}

function matches(listing) {
  const keyword = state.keyword.toLocaleLowerCase('zh-CN');
  const haystack = [listing.title, listing.originalName, listing.description, listing.category, ...listing.tags]
    .join(' ')
    .toLocaleLowerCase('zh-CN');
  if (keyword && !haystack.includes(keyword)) return false;
  if (state.category !== '全部技能' && listing.category !== state.category) return false;
  if (state.stage !== 'all' && listing.stage !== state.stage) return false;
  return true;
}

function sortListings(listings) {
  const copy = [...listings];
  if (state.sort === 'sms') copy.sort((a, b) => b.smsScore - a.smsScore || a.title.localeCompare(b.title, 'zh-CN'));
  if (state.sort === 'recent') copy.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  return copy;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

async function copyInvocation(button, text) {
  if (!text) return;
  button.textContent = '已复制，可去调用';
  button.dataset.copied = 'true';
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'clipboard-fallback';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  button.setAttribute('aria-label', '调用词已复制');
}

function renderEmpty() {
  const article = createElement('article', 'empty-state');
  const copy = createElement('div', 'empty-copy');
  const title = createElement('h3', '', '新的技能正在进入市场');
  const description = createElement('p', '', '平台会先开放安全、清晰的技能说明和调用方式，再逐步补齐安装与企业认证证据。');
  const actions = createElement('div', 'empty-actions');
  const trustLink = createElement('a', 'button button-primary', '查看可信准入');
  trustLink.href = '#trust';
  const publishLink = createElement('a', 'button', '申请发布技能');
  publishLink.href = '#publish';
  actions.append(trustLink, publishLink);
  copy.append(title, description, actions);

  const pipeline = createElement('div', 'pipeline-summary');
  pipeline.append(
    createElement('strong', '', '3'),
    createElement('span', '', '层市场状态保持独立'),
    createElement('p', '', '已收录、可调用和企业认证不会混为一谈')
  );
  article.append(copy, pipeline);
  elements.catalogContent.replaceChildren(article);
}

function renderNoResults() {
  const article = createElement('article', 'no-results-state');
  article.append(
    createElement('strong', '', '没有匹配的已发布技能'),
    createElement('p', '', '试试减少筛选条件，或提交新的业务能力需求。')
  );
  elements.catalogContent.replaceChildren(article);
}

function createSkillCard(listing) {
  const article = createElement('article', 'skill-card');
  const topline = createElement('div', 'card-topline');
  const stageLabel = listing.stage === 'certified' ? '企业认证' : listing.stage === 'callable' ? '可快速调用' : '已收录';
  topline.append(
    createElement('span', 'skill-category', listing.category),
    createElement('span', listing.stage === 'certified' ? 'trust-badge' : 'distribution-badge', stageLabel)
  );

  const title = createElement('h3', '', listing.title);
  const original = createElement('p', 'skill-original', listing.originalName && listing.originalName !== listing.title ? listing.originalName : '造物云自有技能');
  const description = createElement('p', 'skill-description', listing.description);

  const commerce = createElement('div', 'card-commerce');
  const creator = createElement('div', 'creator-summary');
  creator.append(createElement('span', '', '创作者'), createElement('strong', '', listing.creatorName));
  const pricing = createElement('div', 'price-summary');
  pricing.append(createElement('span', '', '获取方式'), createElement('strong', '', listing.offerLabel));
  commerce.append(creator, pricing);

  const evidence = createElement('div', 'card-evidence');
  const sms = createElement('div', 'evidence-item');
  sms.append(createElement('span', '', 'SMS 静态潜力'), createElement('strong', '', listing.smsScore ? `${listing.smsScore} 分 · ${listing.smsTier || '待评级'}` : '待评估'));
  const evaluation = createElement('div', 'evidence-item');
  evaluation.append(createElement('span', '', 'Eval 运行实绩'), createElement('strong', '', listing.evalStatus === 'pass' ? `${Math.round(listing.evalRate * 100)}%` : '待实证'));
  const review = createElement('div', 'evidence-item');
  review.append(createElement('span', '', '使用边界'), createElement('strong', '', listing.installable ? '可安装' : '调用词'));
  evidence.append(sms, evaluation, review);

  const footer = createElement('div', 'card-footer');
  const invoke = createElement('a', 'button button-primary card-invoke', listing.stage === 'indexed' ? '问技能管家' : '到工作台体验');
  if (listing.stage === 'indexed') {
    invoke.href = `https://code.zaowuyun.com/?agent=skill-steward&skill=${encodeURIComponent(listing.detailUrl.split('/').filter(Boolean).at(-1) || '')}`;
  } else {
    invoke.href = `https://code.zaowuyun.com/?skill=${encodeURIComponent(listing.detailUrl.split('/').filter(Boolean).at(-1) || '')}`;
  }
  const link = createElement('a', 'button card-detail', '查看详情');
  link.href = listing.detailUrl || '#trust';
  footer.append(invoke, link);
  const copy = createElement('button', 'card-copy-link', '复制调用词');
  copy.type = 'button';
  copy.disabled = listing.stage === 'indexed' || !listing.invocationText;
  copy.addEventListener('click', () => copyInvocation(copy, listing.invocationText));
  article.append(topline, title, original, description, commerce, evidence, footer, copy);
  return article;
}

function shelfSection(title, note, listings) {
  const section = createElement('section', 'market-shelf');
  const heading = createElement('div', 'shelf-heading');
  const copy = createElement('div');
  copy.append(createElement('h3', '', title), createElement('p', '', note));
  heading.append(copy, createElement('span', 'shelf-count', `${listings.length} 项`));
  const track = createElement('div', 'shelf-track');
  track.append(...listings.slice(0, 3).map((listing) => createSkillCard(listing)));
  section.append(heading, track);
  return section;
}

function renderShelves() {
  if (!elements.shelfList) return;
  const callable = state.listings.filter((listing) => listing.stage === 'callable' || listing.stage === 'certified');
  const presetNames = new Set(['深度榨书智能体', '好设计创新智能体', '创新实验室', '智能密度评估器', '冷静·多维洞察', '督造', '有谱']);
  const presets = state.listings.filter((listing) => presetNames.has(listing.title));
  const creator = state.listings.filter((listing) => listing.creatorName === '造物云 SkillOps');
  const shelves = [
    shelfSection('现在就能进入工作台', '调用方式清晰，适合先从具体任务开始体验。', callable),
    shelfSection('造物云预设技能', '来自已授权预设技能卷，已完成安全归档读取并进入目录。', presets),
    shelfSection('创作者精选', '查看创作者、报价和适用边界，再决定是否纳入企业能力库。', creator)
  ].filter((section) => section.querySelectorAll('.skill-card').length > 0);
  elements.shelfList.replaceChildren(...shelves);
}

function renderCategories() {
  const counts = new Map(fallbackCategories.map((category) => [category, 0]));
  counts.set('全部技能', state.listings.length);
  for (const listing of state.listings) counts.set(listing.category, (counts.get(listing.category) || 0) + 1);
  const categories = [...new Set([...fallbackCategories, ...state.listings.map((listing) => listing.category)])];
  elements.categoryList.replaceChildren(...categories.map((category) => {
    const button = createElement('button', 'category-button');
    button.type = 'button';
    button.dataset.category = category;
    button.setAttribute('aria-pressed', String(category === state.category));
    button.append(createElement('span', '', category), createElement('span', '', String(counts.get(category) || 0)));
    button.addEventListener('click', () => {
      state.category = category;
      render();
    });
    return button;
  }));
  elements.categoryTotal.textContent = `${state.listings.length} 项`;
}

function render() {
  renderCategories();
  renderShelves();
  const filtered = sortListings(state.listings.filter(matches));
  elements.catalogStatus.textContent = `${filtered.length} 项可用能力`;
  const filters = [];
  if (state.category !== '全部技能') filters.push(state.category);
  if (state.keyword) filters.push(`关键词“${state.keyword}”`);
  if (state.stage !== 'all') filters.push(state.stage === 'certified' ? '企业认证' : state.stage === 'callable' ? '可快速调用' : '已收录');
  elements.filterSummary.textContent = filters.length ? `当前筛选：${filters.join('，')}` : '收录、调用与安装分层展示，状态不混淆';
  elements.catalogContent.setAttribute('aria-busy', 'false');
  if (state.listings.length === 0) renderEmpty();
  else if (filtered.length === 0) renderNoResults();
  else elements.catalogContent.replaceChildren(...filtered.map(createSkillCard));
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/v1/catalog', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('catalog unavailable');
    const catalog = await response.json();
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.listings)) throw new Error('catalog invalid');
    state.listings = catalog.listings.map(normalizeListing);
    elements.releaseCount.textContent = String(state.listings.length);
    elements.callableCount.textContent = String(state.listings.filter((listing) => listing.stage === 'callable' || listing.stage === 'certified').length);
    elements.certifiedCount.textContent = String(state.listings.filter((listing) => listing.stage === 'certified').length);
    render();
  } catch {
    elements.catalogStatus.textContent = '目录暂不可用';
    elements.filterSummary.textContent = '为避免展示过期证据，已停止输出';
    elements.catalogContent.setAttribute('aria-busy', 'false');
    const error = createElement('article', 'error-state');
    error.append(
      createElement('strong', '', '目录验证失败'),
      createElement('p', '', '请稍后重试。系统不会在证据状态不明时展示技能。')
    );
    elements.catalogContent.replaceChildren(error);
  }
}

function setTheme(theme) {
  const resolved = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#07070F' : '#F4F5F8');
  elements.themeToggle.setAttribute('aria-pressed', String(resolved === 'dark'));
  elements.themeToggle.querySelector('.theme-toggle-label').textContent = resolved === 'dark' ? '浅色' : '深色';
  try { localStorage.setItem('zaowuyun-theme', resolved); } catch {}
}

elements.heroForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.keyword = elements.heroInput.value.trim();
  elements.searchInput.value = state.keyword;
  render();
  document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelectorAll('[data-suggestion]').forEach((button) => {
  button.addEventListener('click', () => {
    elements.heroInput.value = button.dataset.suggestion || '';
    state.keyword = elements.heroInput.value;
    elements.searchInput.value = state.keyword;
    render();
    document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
elements.searchInput.addEventListener('input', (event) => {
  state.keyword = event.target.value.trim();
  elements.heroInput.value = state.keyword;
  render();
});
elements.distribution.addEventListener('change', (event) => {
  state.stage = event.target.value;
  render();
});
elements.sort.addEventListener('change', (event) => {
  state.sort = event.target.value;
  render();
});
elements.themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

let preferredTheme = 'light';
try { preferredTheme = localStorage.getItem('zaowuyun-theme') || 'light'; } catch {}
setTheme(preferredTheme);
loadCatalog();
