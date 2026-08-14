/** Words an SEO-friendly slug should not carry. */
export const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'in', 'into',
  'is', 'it', 'of', 'on', 'or', 'that', 'the', 'their', 'then', 'there', 'these', 'this',
  'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'your',
]);

export function slugify(input: string, { stripStopwords = false } = {}): string {
  let parts = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (stripStopwords && parts.length > 3) {
    const kept = parts.filter((p) => !STOPWORDS.has(p));
    if (kept.length >= 3) parts = kept;
  }
  return parts.join('-').slice(0, 220).replace(/-+$/, '');
}

export function isSeoFriendlySlug(slug: string, focusKeyword: string): boolean {
  if (!slug) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return false;
  if (slug.length > 75) return false;
  const words = slug.split('-');
  if (words.some((w) => STOPWORDS.has(w))) return false;
  if (focusKeyword.trim()) {
    const kw = slugify(focusKeyword, { stripStopwords: true });
    const kwWords = kw.split('-').filter(Boolean);
    if (!kwWords.every((w) => words.includes(w))) return false;
  }
  return true;
}

export function blogPath(serviceSlug: string, slug: string): string {
  return `/services/${serviceSlug}/blog/${slug}`;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ops.withtatva.ai').replace(/\/$/, '');
}

export function canonicalFor(serviceSlug: string, slug: string): string {
  return `${siteUrl()}${blogPath(serviceSlug, slug)}`;
}
