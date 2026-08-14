import Link from 'next/link';
import { listPostsForAdmin } from '@/lib/posts';
import type { PostStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<PostStatus, string> = {
  draft: 'bg-cream text-ink-muted border-line',
  published: 'bg-ok/10 text-ok border-ok/30',
  internal: 'bg-indigo950/5 text-indigo950 border-indigo950/20',
};

function scoreClass(score: number) {
  if (score >= 80) return 'bg-ok/10 text-ok border-ok/30';
  if (score >= 50) return 'bg-warn/10 text-warn border-warn/30';
  return 'bg-bad/10 text-bad border-bad/30';
}

export default async function AdminBlogList({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const posts = listPostsForAdmin({
    status: (status as PostStatus) || undefined,
    q: q || undefined,
  });

  const tabs: { label: string; value?: PostStatus }[] = [
    { label: 'All' },
    { label: 'Drafts', value: 'draft' },
    { label: 'Published', value: 'published' },
    { label: 'Internal', value: 'internal' },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Editorial</p>
          <h1 className="section-heading mt-1">All posts</h1>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search title or slug"
            className="input !w-64"
          />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button className="btn-ghost">Search</button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = (status ?? '') === (t.value ?? '');
          const href = t.value ? `/admin/blog?status=${t.value}` : '/admin/blog';
          return (
            <Link
              key={t.label}
              href={href}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                active ? 'border-brand-400 bg-brand-50 text-brand-600' : 'border-line bg-white text-ink-muted hover:border-brand-200'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {posts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-display text-lg font-semibold">No posts yet</p>
          <p className="mt-1 text-sm text-ink-muted">Start the first one — it takes a title and a service.</p>
          <Link href="/admin/blog/new" className="btn-primary mt-5">
            New post
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream-50 text-left text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3 font-semibold">Post</th>
                <th className="px-3 py-3 font-semibold">Service</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">SEO</th>
                <th className="px-3 py-3 font-semibold">Words</th>
                <th className="px-5 py-3 text-right font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-b border-line/70 last:border-0 hover:bg-cream-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/blog/${p.id}/edit`} className="font-display font-semibold hover:text-brand-600">
                      {p.title || 'Untitled post'}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      {p.service_slug ? `/services/${p.service_slug}/blog/${p.slug}` : 'No primary service yet'}
                    </p>
                    {p.scheduled_for && p.status === 'draft' ? (
                      <p className="mt-1 text-xs text-warn">
                        Scheduled for {new Date(p.scheduled_for).toLocaleString()}
                      </p>
                    ) : null}
                    {p.last_publish_error ? (
                      <p className="mt-1 text-xs text-bad">{p.last_publish_error}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5 text-ink-muted">
                    {p.service_name ?? '—'}
                    {p.secondary_services.length ? (
                      <span className="block text-xs text-ink-faint">
                        +{p.secondary_services.length} featured
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums ${scoreClass(p.seo_score)}`}>
                      {p.seo_score}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 tabular-nums text-ink-muted">{p.word_count}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-ink-faint">
                    {new Date(p.updated_at + 'Z').toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
