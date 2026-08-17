import { NextResponse } from 'next/server';
import { listPostsForAdmin, savePost } from '@/lib/posts';
import { errorResponse } from '@/lib/api-error';
import { notifySearchConsole } from '@/lib/indexing';
import type { PostStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as PostStatus | null;
  const q = url.searchParams.get('q');
  return NextResponse.json({
    posts: await listPostsForAdmin({ status: status ?? undefined, q: q ?? undefined }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const post = await savePost({ ...body, id: undefined });
    if (post.status === 'published' && post.canonical_url) {
      // Non-fatal: a failed ping must never block the publish itself.
      void notifySearchConsole(post.canonical_url);
    }
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
