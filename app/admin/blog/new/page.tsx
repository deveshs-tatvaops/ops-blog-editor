import { PostEditor } from '@/components/editor/PostEditor';
import { listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New post' };

export default function NewPostPage() {
  return <PostEditor services={listServices()} post={null} />;
}
