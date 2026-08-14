import Link from 'next/link';
import { PostCard } from './PostCard';
import { listPostsForService } from '@/lib/posts';
import type { Service } from '@/lib/types';

/** "From our blog" module for a service landing page. */
export function BlogWidget({ service, limit = 4 }: { service: Service; limit?: number }) {
  const posts = listPostsForService(service.id, limit);
  if (!posts.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">From our blog</p>
          <h2 className="section-heading mt-2">
            Learn before you commit — {service.name.toLowerCase()} insights
          </h2>
        </div>
        <Link href={`/services/${service.slug}/blog`} className="btn-ghost">
          Read all posts
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} showPin />
        ))}
      </div>
    </section>
  );
}
