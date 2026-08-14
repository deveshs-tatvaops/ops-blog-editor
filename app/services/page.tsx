import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Services' };

export default function ServicesIndex() {
  const services = listServices();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-14">
        <p className="eyebrow">What we operate</p>
        <h1 className="section-heading mt-2">Services</h1>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/services/${s.slug}`}
                className="card flex h-full flex-col gap-1 p-5 transition hover:border-brand-300 hover:shadow-pop"
              >
                <span className="font-display text-lg font-semibold">{s.name}</span>
                <span className="text-xs text-ink-faint">/services/{s.slug}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
