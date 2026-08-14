import Link from 'next/link';
import { Logo } from './Logo';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream-50/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" aria-label="TatvaOps home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-ink-muted">
          <Link href="/services" className="hidden hover:text-ink sm:block">
            Services
          </Link>
          <Link href="/admin/blog" className="hidden hover:text-ink sm:block">
            Editor
          </Link>
          <Link href="/services/interior#enquire" className="btn-primary !px-4 !py-2">
            Enquire Now
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo className="text-lg" />
        <p>© {new Date().getFullYear()} TatvaOps. Verified partners, transparent pricing.</p>
      </div>
    </footer>
  );
}
