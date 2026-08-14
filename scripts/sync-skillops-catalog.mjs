import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sourceArg = '../skillops/market-preview/data/listings.json', outputArg = 'public/data/listings.json'] = process.argv.slice(2);
const sourcePath = path.resolve(sourceArg);
const outputPath = path.resolve(outputArg);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const current = JSON.parse(await readFile(outputPath, 'utf8'));

if (source?.schemaVersion !== 1 || !Array.isArray(source.listings)) throw new Error('SkillOps catalog is invalid');

const categoryLabels = new Map([
  ['communication', '沟通协作'],
  ['operations', '研发运维'],
  ['knowledge-management', '数据与知识'],
  ['research', '研究洞察'],
  ['productivity', '办公效率'],
  ['professional', '专业服务'],
  ['dev-programming', '产品与研发'],
  ['design-media', '设计与媒体']
]);

const callableBaseline = new Map(current.listings.filter((item) => item.stage === 'callable').map((item) => [item.slug, item]));

function slug(value) {
  const candidate = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!candidate) throw new Error('listing slug is missing');
  return candidate;
}

function revision(listing) {
  const raw = listing.version?.commit || listing.source?.commit || listing.version?.fingerprint || '';
  const match = String(raw).match(/[0-9a-f]{7,64}/i);
  if (!match) throw new Error(`revision is missing for ${listing.name}`);
  return match[0].slice(0, 12).toLowerCase();
}

function creator(listing) {
  const publisher = listing.catalog?.publisher || {};
  return {
    displayName: publisher.displayNameZh || '开放技能生态',
    handle: publisher.handle || 'source-owner',
    kind: publisher.kind === 'organization' ? 'organization' : 'source_owner',
    verification: publisher.verificationLabelZh || '来源待进一步核验'
  };
}

function offer(listing) {
  const value = listing.catalog?.offer || {};
  const pricing = value.pricing || {};
  return {
    model: ['free', 'one_time', 'subscription', 'contact'].includes(pricing.model) ? pricing.model : 'contact',
    priceLabel: pricing.labelZh || '联系授权',
    rightsLabel: value.rightsLabelZh || '仅查看来源',
    acquisitionLabel: value.acquisitionLabelZh || '联系创作者确认',
    note: value.noteZh || '具体权利以正式授权为准'
  };
}

function transform(listing) {
  const itemSlug = slug(listing.original?.name || listing.name);
  const baseline = callableBaseline.get(itemSlug);
  const coordinate = listing.catalog?.coordinate || `${creator(listing).handle}/${itemSlug}`;
  const safeCoordinate = /^[a-z0-9-]+\/[a-z0-9-]+$/.test(coordinate) ? coordinate : `source-owner/${itemSlug}`;
  const previewEligible = listing.catalog?.launchReadiness?.previewEligible === true;
  const stage = baseline || previewEligible ? 'callable' : 'indexed';
  const packageAudit = listing.security?.status === 'pass' ? 'pass' : 'pending';
  const score = Number.isInteger(listing.sms?.total) ? listing.sms.total : 0;
  const tier = /^(?:S|[A-D])$/.test(listing.sms?.tier || '') ? listing.sms.tier : 'D';
  const licenseAllowed = listing.license?.redistributable === true;
  const invocationText = baseline?.invocation?.text || `请使用${listing.name}，帮助我完成下面的任务：`;
  const examples = baseline?.invocation?.examples || [
    `请先判断${listing.name}是否适合这个任务`,
    `请说明使用${listing.name}时需要补充哪些信息`
  ];

  return {
    skillId: baseline?.skillId || safeCoordinate,
    slug: itemSlug,
    titleZh: listing.name,
    originalName: listing.original?.name || itemSlug,
    descriptionZh: listing.description,
    category: categoryLabels.get(listing.catalog?.category || '') || '其他能力',
    tags: Array.isArray(listing.catalog?.tags) ? listing.catalog.tags.slice(0, 12) : [],
    version: baseline?.version || revision(listing),
    stage,
    distribution: listing.distribution === 'content' ? 'content' : 'source_only',
    creator: creator(listing),
    offer: offer(listing),
    license: baseline?.license || {
      status: licenseAllowed ? 'redistributable' : 'unclear',
      label: licenseAllowed ? '遵循已识别的开源许可，具体权利以上游为准' : '当前仅开放来源索引，正式授权待确认'
    },
    trust: {
      packageAudit: baseline?.trust?.packageAudit || packageAudit,
      smsScore: baseline?.trust?.smsScore ?? score,
      smsTier: baseline?.trust?.smsTier || tier,
      evalStatus: baseline?.trust?.evalStatus || 'pending',
      reviewStatus: baseline?.trust?.reviewStatus || 'pending'
    },
    invocation: { mode: 'copy_text', text: invocationText, examples },
    source: {
      label: baseline?.source?.label || creator(listing).displayName,
      revision: baseline?.source?.revision || revision(listing)
    },
    install: baseline?.install || {
      eligible: false,
      reason: listing.install?.reason || (licenseAllowed ? 'complete_package_missing' : 'redistribution_license_pending')
    }
  };
}

const listings = source.listings.map(transform);
const identities = new Set(listings.map((item) => item.skillId));
const slugs = new Set(listings.map((item) => item.slug));
if (identities.size !== listings.length || slugs.size !== listings.length) throw new Error('public identities are duplicated');

await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  listings
}, null, 2)}\n`);

process.stdout.write(`synced ${listings.length} public skills to ${outputPath}\n`);
