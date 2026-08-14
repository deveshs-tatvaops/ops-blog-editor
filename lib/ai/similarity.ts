import { toPlainText } from '../markdown';

/** Overlapping word n-grams — the unit we compare drafts on. */
export function shingles(text: string, size = 8): Set<string> {
  const words = toPlainText(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(' '));
  return out;
}

export interface LocalMatch {
  postId: number;
  title: string;
  overlapPercent: number;
  samples: string[];
}

/** Duplicate-content check against everything already published on the site. */
export function findLocalOverlap(
  draft: string,
  posts: { id: number; title: string; content_markdown: string }[]
): LocalMatch[] {
  const draftShingles = shingles(draft);
  if (draftShingles.size === 0) return [];

  const matches: LocalMatch[] = [];
  for (const post of posts) {
    const other = shingles(post.content_markdown);
    const shared: string[] = [];
    for (const s of draftShingles) if (other.has(s)) shared.push(s);
    if (!shared.length) continue;
    matches.push({
      postId: post.id,
      title: post.title,
      overlapPercent: Math.round((shared.length / draftShingles.size) * 1000) / 10,
      samples: shared.slice(0, 3),
    });
  }
  return matches.sort((a, b) => b.overlapPercent - a.overlapPercent).slice(0, 5);
}
