/**
 * Unit tests for the pure engines: SEO checks, publish gate, slug rules,
 * FAQ extraction and duplicate detection. Run with `npm test`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';

register('./ts-loader.mjs', import.meta.url);

const { evaluateSeo } = await import('../lib/seo.ts');
const { evaluateGate, resolveCoverAlt } = await import('../lib/publish-gate.ts');
const { slugify, isSeoFriendlySlug, canonicalFor } = await import('../lib/slug.ts');
const { extractFaq } = await import('../lib/schema-jsonld.ts');
const { countWords, readingTime, extractHeadings } = await import('../lib/markdown.ts');
const { findLocalOverlap } = await import('../lib/ai/similarity.ts');

const body = (words) =>
  Array.from({ length: words }, (_, i) => `Word${i}`).join(' ');

const goodPost = {
  title: 'Home Interiors Bangalore: What a 3BHK Really Costs',
  metaTitle: 'Home Interiors Bangalore: What a 3BHK Really Costs',
  metaDescription:
    'What home interiors bangalore projects really cost — a room-by-room budget breakdown for 2BHK and 3BHK homes, plus the factors that move the final price.',
  excerpt: 'A room-by-room cost breakdown.',
  slug: 'home-interiors-bangalore-costs',
  focusKeyword: 'home interiors bangalore',
  contentMarkdown: [
    '## Home interiors bangalore costs, room by room',
    '',
    `Home interiors bangalore pricing starts around six lakh. ${body(700)}`,
    '',
    '### What moves the number',
    '',
    'See our [residential interiors service](/services/interior) and the [Bureau of Indian Standards](https://www.bis.gov.in/).',
    '',
    '![Modular kitchen](/uploads/a.webp)',
  ].join('\n'),
  coverImageAlt: 'Finished modular kitchen',
  wordCountTarget: 600,
  siteHost: 'ops.withtatva.ai',
};

test('a well-formed post passes all 15 SEO checks', () => {
  const result = evaluateSeo(goodPost);
  const failed = result.checks.filter((c) => !c.passed).map((c) => c.id);
  assert.deepEqual(failed, [], `unexpected failures: ${failed.join(', ')}`);
  assert.equal(result.total, 15);
  assert.equal(result.score, 100);
});

test('SEO score is the proportion of checks passed', () => {
  const result = evaluateSeo({ ...goodPost, excerpt: '', coverImageAlt: '' });
  assert.equal(result.passed, 13);
  assert.equal(result.score, Math.round((13 / 15) * 100));
});

test('skipped heading levels fail the hierarchy check', () => {
  const result = evaluateSeo({
    ...goodPost,
    contentMarkdown: goodPost.contentMarkdown.replace('## Home interiors', '#### Home interiors'),
  });
  assert.equal(result.checks.find((c) => c.id === 'heading-hierarchy').passed, false);
});

test('an inline image without alt text fails check 13', () => {
  const result = evaluateSeo({
    ...goodPost,
    contentMarkdown: goodPost.contentMarkdown.replace('![Modular kitchen]', '![]'),
  });
  assert.equal(result.checks.find((c) => c.id === 'inline-image-alt').passed, false);
});

test('an external link on our own host is not an outbound citation', () => {
  const result = evaluateSeo({
    ...goodPost,
    contentMarkdown: goodPost.contentMarkdown.replace(
      'https://www.bis.gov.in/',
      'https://ops.withtatva.ai/services/interior'
    ),
  });
  assert.equal(result.checks.find((c) => c.id === 'external-link').passed, false);
});

test('word count check follows a per-post pillar override', () => {
  const result = evaluateSeo({ ...goodPost, wordCountTarget: 5000 });
  assert.equal(result.checks.find((c) => c.id === 'word-count').passed, false);
});

const gateInput = {
  primaryServiceId: 1,
  title: goodPost.title,
  slug: goodPost.slug,
  excerpt: goodPost.excerpt,
  contentMarkdown: goodPost.contentMarkdown,
  wordCountTarget: 600,
  coverImageUrl: '/uploads/cover.webp',
  coverImageAlt: 'Finished modular kitchen',
  coverPhotoDescription: '',
  metaTitle: goodPost.metaTitle,
  metaDescription: goodPost.metaDescription,
  canonicalUrl: 'https://ops.withtatva.ai/services/interior/blog/home-interiors-bangalore-costs',
};

test('the publish gate opens only when every condition is met', () => {
  const gate = evaluateGate(gateInput);
  assert.equal(gate.canPublish, true);
  assert.equal(gate.blocking.length, 0);
});

test('the gate blocks and names each unmet condition', () => {
  const gate = evaluateGate({ ...gateInput, primaryServiceId: null, coverImageUrl: '' });
  assert.equal(gate.canPublish, false);
  const ids = gate.blocking.map((b) => b.id);
  assert.ok(ids.includes('primary-service'));
  assert.ok(ids.includes('cover-image'));
  assert.ok(gate.blocking.every((b) => b.label.length > 0));
});

test('the gate requires at least one internal link', () => {
  const gate = evaluateGate({
    ...gateInput,
    contentMarkdown: gateInput.contentMarkdown.replace('(/services/interior)', '(https://example.com)'),
  });
  assert.ok(gate.blocking.some((b) => b.id === 'internal-link'));
});

test('a thin post cannot be published', () => {
  const gate = evaluateGate({ ...gateInput, contentMarkdown: 'Too short.' });
  assert.ok(gate.blocking.some((b) => b.id === 'word-count'));
});

test('cover alt falls back to photo description, then title', () => {
  assert.equal(
    resolveCoverAlt({ coverImageAlt: '', coverPhotoDescription: 'A kitchen', title: 'T' }),
    'A kitchen'
  );
  assert.equal(resolveCoverAlt({ coverImageAlt: '', coverPhotoDescription: '', title: 'T' }), 'T');
  assert.equal(resolveCoverAlt({ coverImageAlt: 'Alt', coverPhotoDescription: 'x', title: 'T' }), 'Alt');
});

test('slugs are kebab-case and drop stopwords', () => {
  assert.equal(
    slugify('How Much Do Home Interiors Cost in Bangalore?', { stripStopwords: true }),
    'much-do-home-interiors-cost-bangalore'
  );
  assert.equal(slugify('Landscaping & Outdoor Development'), 'landscaping-and-outdoor-development');
});

test('slug SEO check requires the focus keyword and no stopwords', () => {
  assert.equal(isSeoFriendlySlug('home-interiors-bangalore-costs', 'home interiors bangalore'), true);
  assert.equal(isSeoFriendlySlug('the-home-interiors-bangalore', 'home interiors bangalore'), false);
  assert.equal(isSeoFriendlySlug('Home_Interiors', 'home interiors'), false);
  assert.equal(isSeoFriendlySlug('kitchen-design', 'home interiors bangalore'), false);
});

test('canonical URLs sit under the primary service path', () => {
  assert.equal(
    canonicalFor('interior', 'my-post'),
    'https://ops.withtatva.ai/services/interior/blog/my-post'
  );
});

test('FAQ blocks are extracted for schema', () => {
  const faq = extractFaq(
    '## FAQ\n\n### What does it cost?\n\nBetween six and eighteen lakh.\n\n### How long does it take?\n\nTen to fourteen weeks.'
  );
  assert.equal(faq.length, 2);
  assert.equal(faq[0].question, 'What does it cost?');
  assert.match(faq[0].answer, /six and eighteen lakh/);
});

test('a post with no FAQ section yields no FAQ pairs', () => {
  assert.deepEqual(extractFaq('## Costs\n\nSome prose.'), []);
});

test('word count ignores markdown syntax and images', () => {
  assert.equal(countWords('## Heading\n\n![alt](/a.png)\n\nOne two three.'), 4);
  assert.equal(readingTime(0), 0);
  assert.equal(readingTime(225), 1);
  assert.equal(readingTime(500), 3);
});

test('headings are parsed with their levels', () => {
  const headings = extractHeadings('# A\n## B\n### C');
  assert.deepEqual(headings.map((h) => h.level), [1, 2, 3]);
});

test('duplicate phrasing across posts is detected', () => {
  const shared = 'modular kitchens in bangalore usually cost between three and six lakh rupees total';
  const matches = findLocalOverlap(`Intro sentence. ${shared} And more text here.`, [
    { id: 1, title: 'Old post', content_markdown: `Different opening. ${shared} Different close.` },
    { id: 2, title: 'Unrelated', content_markdown: 'Solar panels need an inverter and a net meter.' },
  ]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].postId, 1);
  assert.ok(matches[0].overlapPercent > 0);
});
