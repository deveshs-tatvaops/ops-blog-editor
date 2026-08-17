import { NextResponse } from 'next/server';
import { MODEL, getClient } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { findLocalOverlap } from '@/lib/ai/similarity';
import { listPostsForAdmin } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

interface Match {
  source: string;
  excerpt: string;
  note: string;
}

export async function POST(req: Request) {
  try {
    const { content_markdown, id } = await req.json();
    const draft = String(content_markdown ?? '');

    // 1. Deterministic pass: duplicate content against our own published posts.
    const published = (await listPostsForAdmin({ status: 'published' })).filter((p) => p.id !== id);
    const local = findLocalOverlap(draft, published);
    const matches: Match[] = local
      .filter((m) => m.overlapPercent >= 2)
      .map((m) => ({
        source: `Existing post: ${m.title}`,
        excerpt: m.samples[0] ?? '',
        note: `${m.overlapPercent}% of this draft's phrasing already appears in that post. Use "Also feature on" instead of restating it.`,
      }));

    // 2. Web pass: distinctive phrasing that already exists elsewhere online.
    let verdict = 'Checked against every published TatvaOps post.';
    let risk: 'low' | 'medium' | 'high' = matches.length ? 'medium' : 'low';

    try {
      const client = getClient();
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system:
          'You check drafts for unoriginal writing. Search the web for the draft\'s most distinctive sentences. Report only genuine matches — near-identical phrasing on a specific page — not shared subject matter or common industry phrases.',
        output_config: { effort: 'medium' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 } as never],
        messages: [
          {
            role: 'user',
            content: `Check this draft for copied phrasing. Reply with a one-paragraph verdict, then a line "RISK: low|medium|high", then one line per match formatted "MATCH | <source url or name> | <matching excerpt> | <note>". If there are no web matches, say so and emit no MATCH lines.\n\n--- DRAFT ---\n${draft.slice(0, 40000)}`,
          },
        ],
      });

      const text = message.content
        .filter((b): b is { type: 'text'; text: string } & typeof b => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      const riskLine = /^RISK:\s*(low|medium|high)/im.exec(text);
      if (riskLine) risk = riskLine[1].toLowerCase() as typeof risk;
      verdict = text.split(/^RISK:/im)[0].trim() || verdict;

      for (const line of text.split('\n')) {
        const parts = line.split('|').map((p) => p.trim());
        if (parts[0] === 'MATCH' && parts.length >= 3) {
          matches.push({ source: parts[1], excerpt: parts[2], note: parts[3] ?? '' });
        }
      }
    } catch (err) {
      // The local duplicate check still stands on its own if the web pass fails.
      verdict += ` Web check unavailable: ${err instanceof Error ? err.message : 'request failed'}.`;
    }

    if (matches.some((m) => m.source.startsWith('Existing post')) && risk === 'low') risk = 'medium';

    return NextResponse.json({ report: { verdict, risk, matches } });
  } catch (err) {
    return aiError(err);
  }
}
