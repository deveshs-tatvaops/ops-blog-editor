import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const services = await listServices();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <p className="eyebrow">TatvaOps blog system</p>
        <h1 className="section-heading mt-3 max-w-2xl">
          One post, one canonical URL — surfaced across every service it serves.
        </h1>
        <p className="mt-4 max-w-2xl text-ink-muted">
          Each service owns its own blog at <code className="rounded bg-white px-1.5 py-0.5">/services/&lt;service&gt;/blog</code>.
          Write once in the editor, pick a primary service for the URL, and feature the same article on
          any other service without duplicating content.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/admin/blog" className="btn-primary">
            Open the blog editor
          </Link>
          <Link href="/services" className="btn-ghost">
            Browse services
          </Link>
        </div>

        <h2 className="mt-16 font-display text-xl font-bold">Service blogs</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/services/${s.slug}/blog`}
                className="card flex h-full flex-col justify-between gap-2 p-4 transition hover:border-brand-300 hover:shadow-pop"
              >
                <span className="font-display font-semibold">{s.name}</span>
                <span className="text-xs text-ink-faint">/services/{s.slug}/blog</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
