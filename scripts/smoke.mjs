/**
 * End-to-end smoke test: exercises the publish gate, canonical URL rules,
 * secondary-service surfacing and the 404 on non-primary paths.
 * Usage: node scripts/smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
}

async function api(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { res, json, text };
}

const body = (over = {}) => ({
  title: 'What home interiors actually cost in Bangalore',
  excerpt: 'A plain-English breakdown of what a 2BHK, 3BHK and villa interior package costs.',
  content_markdown: [
    '## What home interiors cost in Bangalore',
    '',
    'Home interiors in Bangalore usually land between ₹6 lakh and ₹18 lakh for a 3BHK. ' +
      'The spread comes down to material grade, civil work and how much of the house is modular. ' +
      Array.from({ length: 60 }, (_, i) => `Cost driver ${i} explained clearly for homeowners planning a budget.`).join(' '),
    '',
    '### What drives the number',
    '',
    'See our [residential interiors service](/services/interior) for scope, and the ' +
      '[Bureau of Indian Standards](https://www.bis.gov.in/) for material grading.',
    '',
    '![Modular kitchen in a Whitefield apartment](/uploads/sample.webp)',
  ].join('\n'),
  focus_keyword: 'home interiors bangalore',
  meta_title: 'Home Interiors Bangalore: Real Costs for 2BHK and 3BHK',
  meta_description:
    'What home interiors bangalore projects really cost in 2026 — a room-by-room budget breakdown for 2BHK, 3BHK and villa homes, with the factors that move the price.',
  author_name: 'TatvaOps Editorial',
  cover_image_url: '/uploads/cover.webp',
  cover_image_alt: 'Finished modular kitchen in a Bangalore apartment',
  primary_service_id: 1,
  secondary_services: [{ service_id: 2, pinned: true }],
  tags: ['interiors', 'budget'],
  status: 'draft',
  ...over,
});

const run = async () => {
  // 1. Gate blocks a thin draft from publishing.
  const thin = await api('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Too thin', primary_service_id: 1, status: 'published' }),
  });
  check('publish gate rejects an incomplete post', thin.res.status === 422, `status ${thin.res.status}`);
  check(
    'gate response lists blocking reasons',
    Array.isArray(thin.json?.blocking) && thin.json.blocking.length > 0
  );

  // 2. A complete post saves as a draft with derived fields computed.
  const draft = await api('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body()),
  });
  check('complete post saves as draft', draft.res.status === 201, draft.json?.error ?? '');
  const post = draft.json?.post;
  check('slug derived from title', post?.slug?.startsWith('home-interiors-actually-cost'), post?.slug);
  check('canonical URL points at the primary service', post?.canonical_url?.includes('/services/interior/blog/'), post?.canonical_url);
  check('word count and reading time computed', post?.word_count > 600 && post?.reading_time_minutes > 0, `${post?.word_count} words`);
  check('SEO score computed', typeof post?.seo_score === 'number' && post.seo_score > 0, `score ${post?.seo_score}`);
  check('CTA link defaults to the primary service', post?.cta_link_url === '/services/interior#enquire', post?.cta_link_url);

  // 3. Publish it.
  const published = await api(`/api/posts/${post.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body(), status: 'published' }),
  });
  check('post publishes once the gate is satisfied', published.res.status === 200, published.json?.error ?? '');
  check('published_at set', !!published.json?.post?.published_at);
  check('schema cached with Article + Breadcrumb', (() => {
    const blocks = JSON.parse(published.json?.post?.schema_jsonld || '[]');
    return blocks.some((b) => b['@type'] === 'Article') && blocks.some((b) => b['@type'] === 'BreadcrumbList');
  })());

  // 4. Public routing.
  const canonical = await api(`/services/interior/blog/${post.slug}`);
  check('canonical post URL renders', canonical.res.status === 200, `status ${canonical.res.status}`);
  check('post page includes JSON-LD', canonical.text.includes('application/ld+json'));

  const wrongService = await api(`/services/home-renovation/blog/${post.slug}`);
  check('secondary service path 404s (one canonical URL)', wrongService.res.status === 404, `status ${wrongService.res.status}`);

  const primaryIndex = await api('/services/interior/blog');
  check('primary service blog index lists the post', primaryIndex.text.includes(post.title));

  const secondaryIndex = await api('/services/home-renovation/blog');
  check('secondary service blog index surfaces the post', secondaryIndex.text.includes(post.title));

  const landing = await api('/services/home-renovation');
  check('service landing widget surfaces the post', landing.text.includes(post.title));

  const sitemap = await api('/sitemap.xml');
  check('sitemap includes the published post', sitemap.text.includes(`/services/interior/blog/${post.slug}`));

  // 5. Internal status: live URL, excluded from listings and sitemap.
  const internal = await api(`/api/posts/${post.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'internal' }),
  });
  check('post can be switched to internal', internal.res.status === 200);
  const internalPage = await api(`/services/interior/blog/${post.slug}`);
  check('internal post keeps a live URL', internalPage.res.status === 200);
  check('internal post is noindex', /noindex/.test(internalPage.text));
  const indexAfter = await api('/services/interior/blog');
  check('internal post drops out of listings', !indexAfter.text.includes(`blog/${post.slug}"`));
  const sitemapAfter = await api('/sitemap.xml');
  check('internal post drops out of the sitemap', !sitemapAfter.text.includes(`/blog/${post.slug}<`));

  await api(`/api/posts/${post.id}`, { method: 'DELETE' });


  // 6. Scheduled publish re-validates the gate and fails safe.
  const scheduled = await api('/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...body({ title: 'Scheduled thin post', content_markdown: 'Too short to publish.' }),
      cover_image_url: '',
      scheduled_for: new Date(Date.now() - 60_000).toISOString(),
    }),
  });
  check('a scheduled post saves as a draft', scheduled.res.status === 201, scheduled.json?.error ?? '');

  const cron = await api('/api/cron/publish-scheduled');
  check('scheduler runs and reports what it checked', cron.res.status === 200, `status ${cron.res.status}`);
  check(
    'scheduler holds back a post that regressed',
    cron.json?.failed?.some((f) => f.id === scheduled.json.post.id),
    JSON.stringify(cron.json?.failed ?? [])
  );
  const heldBack = await api(`/api/posts/${scheduled.json.post.id}`);
  check('held-back post stays a draft', heldBack.json?.post?.status === 'draft');
  check('held-back post records why', /Scheduled publish held back/.test(heldBack.json?.post?.last_publish_error ?? ''));
  await api(`/api/posts/${scheduled.json.post.id}`, { method: 'DELETE' });

  // 7. Media pipeline converts uploads to WebP.
  const { default: sharp } = await import('sharp');
  const square = await sharp({
    create: { width: 200, height: 200, channels: 3, background: '#F26522' },
  })
    .png()
    .toBuffer();
  const wide = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: '#141345' },
  })
    .png()
    .toBuffer();

  const form = new FormData();
  form.append('file', new Blob([square], { type: 'image/png' }), 'test.png');
  const upload = await api('/api/upload', { method: 'POST', body: form });
  check('upload converts to WebP', upload.json?.url?.endsWith('.webp'), upload.json?.error ?? upload.json?.url);

  const badForm = new FormData();
  badForm.append('file', new Blob([square], { type: 'image/png' }), 'test.png');
  badForm.append('enforceAspect', '16:9');
  const badUpload = await api('/api/upload', { method: 'POST', body: badForm });
  check('cover upload rejects non-16:9 images', badUpload.res.status === 400, badUpload.json?.error ?? '');

  const goodForm = new FormData();
  goodForm.append('file', new Blob([wide], { type: 'image/png' }), 'cover.png');
  goodForm.append('enforceAspect', '16:9');
  const goodUpload = await api('/api/upload', { method: 'POST', body: goodForm });
  check('cover upload accepts a 16:9 image', goodUpload.res.status === 200, goodUpload.json?.error ?? '');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
