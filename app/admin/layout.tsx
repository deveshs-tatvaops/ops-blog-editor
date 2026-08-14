import Link from 'next/link';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Blog editor' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="TatvaOps home">
              <Logo className="text-xl" />
            </Link>
            <span className="hidden rounded-full bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-muted sm:block">
              Blog editor
            </span>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link href="/admin/blog" className="text-ink-muted hover:text-ink">
              All posts
            </Link>
            <Link href="/admin/blog/new" className="btn-primary !px-4 !py-2">
              New post
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
