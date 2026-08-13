const elements = {
  catalogContent: document.querySelector('#catalog-content'),
  catalogStatus: document.querySelector('#catalog-status'),
  categoryList: document.querySelector('#category-list'),
  categoryTotal: document.querySelector('#category-total'),
  distribution: document.querySelector('#distribution-filter'),
  filterSummary: document.querySelector('#filter-summary'),
  heroForm: document.querySelector('#hero-search'),
  heroInput: document.querySelector('#hero-search-input'),
  releaseCount: document.querySelector('#release-count'),
  searchInput: document.querySelector('#catalog-search-input'),
  sort: document.querySelector('#sort-select'),
  themeToggle: document.querySelector('#theme-toggle')
};

const state = {
  category: '全部技能',
  distribution: 'all',
  keyword: '',
  listings: [],
  sort: 'recommended'
};

const fallbackCategories = ['全部技能', '办公效率', '内容创作', '研发运维', '数据与知识', '设计与媒体'];

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
  const source = listing?.source && typeof listing.source === 'object' ? listing.source : {};
  const title = safeText(listing?.titleZh) || safeText(metadata.titleZh) || safeText(listing?.name) || '未命名技能';
  const originalName = safeText(listing?.name) || safeText(metadata.originalName);
  const description = safeText(listing?.descriptionZh) || safeText(metadata.descriptionZh) || '已通过造物云可信准入的技能。';
  const category = safeText(listing?.category) || safeText(catalog.category) || '其他能力';
  const tags = Array.isArray(listing?.tags) ? listing.tags.map(safeText).filter(Boolean) : [];
  const installable = install.eligible === true;
  return {
    category,
    description,
    detailUrl: safeUrl(listing?.canonicalUrl) || safeUrl(listing?.detailUrl),
    evalRate: number(evaluation.successRate),
    installable,
    originalName,
    publishedAt: safeText(catalog.publishedAt) || safeText(listing?.publishedAt),
    smsScore: number(sms.total ?? sms.score),
    sourceUrl: safeUrl(source.url) || safeUrl(source.upstreamUrl),
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
  if (state.distribution === 'installable' && !listing.installable) return false;
  if (state.distribution === 'source_only' && listing.installable) return false;
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

function renderEmpty() {
  const article = createElement('article', 'empty-state');
  const copy = createElement('div', 'empty-copy');
  const title = createElement('h3', '', '首批技能正在完成发布前评估');
  const description = createElement('p', '', '正式目录目前为空。首批候选正在完成 Eval 实证与双人独立终审，通过后才会形成可公开的 Registry Release。');
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
    createElement('span', '', '项首批候选处于评估流程'),
    createElement('p', '', '当前均不可安装，也不计入正式目录')
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
  topline.append(
    createElement('span', 'skill-category', listing.category),
    createElement('span', listing.installable ? 'trust-badge' : 'distribution-badge', listing.installable ? '可安装' : '仅来源')
  );

  const title = createElement('h3', '', listing.title);
  const original = createElement('p', 'skill-original', listing.originalName && listing.originalName !== listing.title ? listing.originalName : '造物云可信技能');
  const description = createElement('p', 'skill-description', listing.description);

  const evidence = createElement('div', 'card-evidence');
  const sms = createElement('div', 'evidence-item');
  sms.append(createElement('span', '', 'SMS 静态潜力'), createElement('strong', '', listing.smsScore ? `${listing.smsScore} 分` : '已验证'));
  const evaluation = createElement('div', 'evidence-item');
  evaluation.append(createElement('span', '', 'Eval 运行实绩'), createElement('strong', '', listing.evalRate ? `${Math.round(listing.evalRate * 100)}%` : '已绑定'));
  const review = createElement('div', 'evidence-item');
  review.append(createElement('span', '', '人类终审'), createElement('strong', '', '双人通过'));
  evidence.append(sms, evaluation, review);

  const footer = createElement('div', 'card-footer');
  footer.append(createElement('span', 'card-version', listing.version));
  const link = createElement('a', 'card-link', listing.detailUrl ? '查看详情' : '查看来源');
  link.href = listing.detailUrl || listing.sourceUrl || '#trust';
  if (link.href.startsWith('http')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  footer.append(link);
  article.append(topline, title, original, description, evidence, footer);
  return article;
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
  const filtered = sortListings(state.listings.filter(matches));
  elements.catalogStatus.textContent = `${filtered.length} 项已验证能力`;
  const filters = [];
  if (state.category !== '全部技能') filters.push(state.category);
  if (state.keyword) filters.push(`关键词“${state.keyword}”`);
  if (state.distribution !== 'all') filters.push(state.distribution === 'installable' ? '可安装' : '仅来源');
  elements.filterSummary.textContent = filters.length ? `当前筛选：${filters.join('，')}` : '仅展示证据当前的公开 Release';
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
elements.searchInput.addEventListener('input', (event) => {
  state.keyword = event.target.value.trim();
  elements.heroInput.value = state.keyword;
  render();
});
elements.distribution.addEventListener('change', (event) => {
  state.distribution = event.target.value;
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
