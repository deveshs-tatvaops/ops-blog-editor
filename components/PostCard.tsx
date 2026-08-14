import Link from 'next/link';
import type { PostWithService } from '@/lib/types';

function formatDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function PostCard({ post, showPin }: { post: PostWithService; showPin?: boolean }) {
  const href = `/services/${post.service_slug}/blog/${post.slug}`;
  const alt = post.cover_image_alt || post.cover_photo_description || post.title;
  return (
    <article className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={href} className="block">
        <div className="relative aspect-video overflow-hidden bg-cream-200">
          {post.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_image_url}
              alt={alt}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-brand-gradient text-white/90">
              <span className="font-display text-sm font-semibold uppercase tracking-widest">TatvaOps</span>
            </div>
          )}
          {showPin && post.pinned ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-600">
              Featured
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">
          {post.topic_label || post.service_name}
        </p>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">
          <Link href={href} className="hover:text-brand-600">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-muted">{post.excerpt}</p>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
          {formatDate(post.published_at)}
          <span aria-hidden>·</span>
          {post.reading_time_minutes} min read
        </p>
      </div>
    </article>
  );
}
