import { notFound } from 'next/navigation';
import { PostEditor } from '@/components/editor/PostEditor';
import { getPost, listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit post' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = getPost(Number(id));
  if (!post) notFound();
  return <PostEditor services={listServices()} post={post} />;
}
