import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getServiceBySlug, listPostsForService } from '@/lib/posts';
import { siteUrl } from '@/lib/slug';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ service: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service: slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) return { title: 'Not found' };
  return {
    title: `${service.name} blog`,
    description: `Guides, costs and checklists for ${service.name.toLowerCase()} from the TatvaOps team.`,
    alternates: { canonical: `${siteUrl()}/services/${service.slug}/blog` },
  };
}

export default async function ServiceBlogIndex({ params }: Props) {
  const { service: slug } = await params;
  const service = getServiceBySlug(slug);
  if (!service) notFound();

  const posts = listPostsForService(service.id);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12">
        <nav className="text-xs text-ink-faint">
          <Link href="/services" className="hover:text-ink">
            Services
          </Link>
          {' › '}
          <Link href={`/services/${service.slug}`} className="hover:text-ink">
            {service.name}
          </Link>
          {' › Blog'}
        </nav>

        <header className="mt-4 max-w-3xl">
          <p className="eyebrow">{service.name}</p>
          <h1 className="section-heading mt-2">Learn before you design, build or buy</h1>
          <p className="mt-3 text-ink-muted">
            Practical, plain-English guides from the TatvaOps operations team — written for homeowners and
            property owners, not for search engines.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="card mt-10 p-12 text-center text-ink-muted">
            No posts published for this service yet.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} showPin />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
