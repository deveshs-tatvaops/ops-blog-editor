import { NextResponse } from 'next/server';
import { notifySearchConsole } from '@/lib/indexing';
import { PublishGateError, flagPublishFailure, listDuePosts, savePost } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Flips scheduled drafts to published. The gate is re-validated inside savePost,
 * so a post whose content regressed after scheduling fails safe: it stays a
 * draft and the author sees why in the editorial list.
 */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const due = await listDuePosts();
  const published: string[] = [];
  const failed: { id: number; title: string; blocking: string[] }[] = [];

  for (const post of due) {
    try {
      const saved = await savePost({ id: post.id, status: 'published', scheduled_for: null });
      published.push(saved.canonical_url || saved.slug);
      await notifySearchConsole(saved.canonical_url);
    } catch (err) {
      if (err instanceof PublishGateError) {
        const labels = err.blocking.map((b) => b.label);
        await flagPublishFailure(post.id, `Scheduled publish held back: ${labels.join(', ')}`);
        failed.push({ id: post.id, title: post.title, blocking: labels });
      } else {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await flagPublishFailure(post.id, `Scheduled publish failed: ${message}`);
        failed.push({ id: post.id, title: post.title, blocking: [message] });
      }
    }
  }

  return NextResponse.json({ checked: due.length, published, failed });
}

export const GET = run;
export const POST = run;
