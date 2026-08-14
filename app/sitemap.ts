import type { MetadataRoute } from 'next';
import { listPublishedForSitemap, listServices } from '@/lib/posts';
import { canonicalFor, siteUrl } from '@/lib/slug';

export const dynamic = 'force-dynamic';

/** Published posts only — "internal" posts keep a live URL but stay out of the sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const services = listServices();
  const posts = listPublishedForSitemap();

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    ...services.flatMap((s) => [
      { url: `${base}/services/${s.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 },
      { url: `${base}/services/${s.slug}/blog`, changeFrequency: 'daily' as const, priority: 0.7 },
    ]),
    ...posts.map((p) => ({
      url: p.canonical_url || canonicalFor(p.service_slug, p.slug),
      lastModified: new Date(p.updated_at + 'Z'),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
