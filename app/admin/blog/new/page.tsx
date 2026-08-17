import { PostEditor } from '@/components/editor/PostEditor';
import { listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New post' };

export default async function NewPostPage() {
  return <PostEditor services={await listServices()} post={null} />;
}
