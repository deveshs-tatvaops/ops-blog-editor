/**
 * Reproduces the production bug this project hit on Vercel: two serverless
 * instances, each with its own local database, mean a post created by one
 * request is a 404 for the next. Proves that a shared database fixes it.
 *
 * Usage: node scripts/multi-instance.mjs <urlA> <urlB>
 * The two servers must be started against the SAME database for the shared
 * case, and different ones for the isolated case.
 */
const [A, B] = process.argv.slice(2);
if (!A || !B) {
  console.error('Usage: node scripts/multi-instance.mjs <urlA> <urlB>');
  process.exit(1);
}

const post = {
  title: 'Cross instance visibility check',
  excerpt: 'Written to instance A, read from instance B.',
  content_markdown: '## Heading\n\nSee our [interiors service](/services/interior).',
  primary_service_id: 1,
  status: 'draft',
};

const created = await fetch(`${A}/api/posts`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(post),
});
const { post: saved } = await created.json();
console.log(`instance A created post ${saved.id} (${created.status})`);

const fromB = await fetch(`${B}/api/posts/${saved.id}`);
const editFromB = await fetch(`${B}/admin/blog/${saved.id}/edit`);
console.log(`instance B  GET /api/posts/${saved.id}        -> ${fromB.status}`);
console.log(`instance B  GET /admin/blog/${saved.id}/edit  -> ${editFromB.status}`);

await fetch(`${A}/api/posts/${saved.id}`, { method: 'DELETE' });

const ok = fromB.status === 200 && editFromB.status === 200;
console.log(ok ? '\nPASS — both instances see the same post' : '\nFAIL — instances have separate data');
process.exit(ok ? 0 : 1);
