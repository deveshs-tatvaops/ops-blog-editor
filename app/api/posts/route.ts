import { NextResponse } from 'next/server';
import { listPostsForAdmin, savePost } from '@/lib/posts';
import { errorResponse } from '@/lib/api-error';
import type { PostStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') as PostStatus | null;
  const q = url.searchParams.get('q');
  return NextResponse.json({
    posts: listPostsForAdmin({ status: status ?? undefined, q: q ?? undefined }),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const post = savePost({ ...body, id: undefined });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
