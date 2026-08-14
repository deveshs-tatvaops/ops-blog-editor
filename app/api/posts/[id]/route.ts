import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/api-error';
import { deletePost, getPost, savePost } from '@/lib/posts';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const post = getPost(Number(id));
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const body = await req.json();
    const post = savePost({ ...body, id: Number(id) });
    return NextResponse.json({ post });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  deletePost(Number(id));
  return NextResponse.json({ ok: true });
}
