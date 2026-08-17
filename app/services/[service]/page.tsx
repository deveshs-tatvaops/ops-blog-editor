import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogWidget } from '@/components/BlogWidget';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getServiceBySlug } from '@/lib/posts';
import { siteUrl } from '@/lib/slug';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ service: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service: slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: 'Not found' };
  return {
    title: service.name,
    alternates: { canonical: `${siteUrl()}/services/${service.slug}` },
  };
}

/**
 * Stand-in for the existing service landing page — this build only owns the
 * "From our blog" module that gets dropped into the real page.
 */
export default async function ServiceLanding({ params }: Props) {
  const { service: slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-line bg-cream-50">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="eyebrow">TatvaOps service</p>
            <h1 className="section-heading mt-3 max-w-2xl">{service.name}</h1>
            <p className="mt-4 max-w-2xl text-ink-muted">
              Verified partners, transparent pricing and milestone-linked payments.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={service.cta_default_url} className="btn-primary" id="enquire">
                Enquire Now
              </a>
              <Link href={`/services/${service.slug}/blog`} className="btn-ghost">
                Read the blog
              </Link>
            </div>
          </div>
        </section>

        <BlogWidget service={service} />
      </main>
      <SiteFooter />
    </>
  );
}
