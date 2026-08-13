const catalogContent = document.querySelector('#catalog-content');
const catalogStatus = document.querySelector('#catalog-status');

function text(value) {
  return typeof value === 'string' ? value : '';
}

function renderEmpty() {
  catalogContent.innerHTML = `
    <article class="empty-state">
      <div class="empty-index" aria-hidden="true">00</div>
      <div>
        <p class="empty-kicker">首批能力正在进入终审</p>
        <h3>我们宁愿先空着，也不把未经验证的技能放进市场。</h3>
        <p>首批 1–3 个技能将完成完整包校验、Eval 实证和双人独立终审后发布。目录同步不会影响当前页面的可用性。</p>
      </div>
    </article>`;
}

function renderListings(listings) {
  if (listings.length === 0) {
    renderEmpty();
    return;
  }
  catalogContent.replaceChildren(...listings.map((listing) => {
    const article = document.createElement('article');
    article.className = 'skill-card';
    const title = document.createElement('h3');
    title.textContent = text(listing.titleZh) || text(listing.name) || '未命名技能';
    const description = document.createElement('p');
    description.textContent = text(listing.descriptionZh) || '已通过可信准入的造物云技能。';
    const meta = document.createElement('p');
    meta.className = 'skill-meta';
    meta.textContent = `${text(listing.version) || '固定版本'} · 已形成可信 Release`;
    article.append(title, description, meta);
    return article;
  }));
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/v1/catalog', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('catalog unavailable');
    const catalog = await response.json();
    if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.listings)) throw new Error('catalog invalid');
    catalogStatus.textContent = `${catalog.listings.length} 项已验证能力`;
    renderListings(catalog.listings);
  } catch {
    catalogStatus.textContent = '目录暂不可用';
    catalogContent.innerHTML = '<p class="error-state">目录验证失败。为避免展示过期证据，系统已停止输出技能列表。</p>';
  }
}

loadCatalog();

