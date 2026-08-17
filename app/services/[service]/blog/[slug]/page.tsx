import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CtaBlock, StickyCta } from '@/components/CtaBlock';
import { PostCard } from '@/components/PostCard';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { withHeadingIds } from '@/lib/markdown';
import { getPublishedPostByPath, getService, listRelatedPosts } from '@/lib/posts';
import { buildJsonLd } from '@/lib/schema-jsonld';
import { canonicalFor } from '@/lib/slug';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ service: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service, slug } = await params;
  const post = await getPublishedPostByPath(service, slug);
  if (!post) return { title: 'Not found' };
  const canonical = post.canonical_url || canonicalFor(post.service_slug, post.slug);
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    alternates: { canonical },
    // "Internal" posts stay reachable by URL but must never be indexed or listed.
    robots: post.status === 'internal' ? { index: false, follow: false } : undefined,
    openGraph: {
      type: 'article',
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      url: canonical,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
      publishedTime: post.published_at ?? undefined,
    },
  };
}

function formatDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: Props) {
  const { service: serviceSlug, slug } = await params;
  const post = await getPublishedPostByPath(serviceSlug, slug);
  // Only the primary service's path resolves — secondary services surface the post
  // in their listings but never get a second working URL.
  if (!post) notFound();

  const service = (await getService(post.primary_service_id))!;
  const ctaService = (await getService(post.cta_service_id)) ?? service;
  const related = await listRelatedPosts(post, 3);
  const jsonld = post.schema_jsonld || JSON.stringify(buildJsonLd(post, service));
  const alt = post.cover_image_alt || post.cover_photo_description || post.title;

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        // Cached at save time so what ships matches what the editor previewed.
        dangerouslySetInnerHTML={{ __html: jsonld }}
      />
      <main className="pb-24">
        <article className="mx-auto max-w-3xl px-5 py-10">
          <nav className="text-xs text-ink-faint">
            <Link href={`/services/${service.slug}`} className="hover:text-ink">
              {service.name}
            </Link>
            {' › '}
            <Link href={`/services/${service.slug}/blog`} className="hover:text-ink">
              Blog
            </Link>
          </nav>

          <p className="eyebrow mt-5">{post.topic_label || service.name}</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight sm:text-4xl">{post.title}</h1>
          <p className="mt-4 text-lg text-ink-muted">{post.excerpt}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-faint">
            {post.author_name ? <span>By {post.author_name}</span> : null}
            {post.published_at ? <span aria-hidden>·</span> : null}
            <span>{formatDate(post.published_at)}</span>
            <span aria-hidden>·</span>
            <span>{post.reading_time_minutes} min read</span>
            {post.status === 'internal' ? (
              <span className="chip !border-indigo950/20 !bg-indigo950/5 !text-indigo950">Internal</span>
            ) : null}
          </div>

          {post.cover_image_url ? (
            <figure className="mt-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.cover_image_url}
                alt={alt}
                className="aspect-video w-full rounded-2xl object-cover"
              />
              {post.cover_photo_description || post.cover_photo_credit ? (
                <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-faint">
                  <span>{post.cover_photo_description}</span>
                  {post.cover_photo_credit ? <span>{post.cover_photo_credit}</span> : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <div
            className="prose-ops mt-8"
            dangerouslySetInnerHTML={{ __html: withHeadingIds(post.content_html) }}
          />

          {post.tags.length ? (
            <ul className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <li key={t} className="chip">
                  #{t}
                </li>
              ))}
            </ul>
          ) : null}

          <CtaBlock
            label={post.cta_button_label || 'Enquire Now'}
            href={post.cta_link_url || `/services/${ctaService.slug}#enquire`}
            service={ctaService.name}
          />
        </article>

        {related.length ? (
          <section className="mx-auto max-w-6xl px-5 py-10">
            <h2 className="section-heading !text-2xl">Related reading</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <PostCard key={r.id} post={r} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <StickyCta
        label={post.cta_button_label || 'Enquire Now'}
        href={post.cta_link_url || `/services/${ctaService.slug}#enquire`}
        title={post.title}
      />
      <SiteFooter />
    </>
  );
}
