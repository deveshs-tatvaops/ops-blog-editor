import {
  countWords,
  extractHeadings,
  extractImages,
  extractLinks,
  firstWords,
  toPlainText,
} from './markdown';
import { isSeoFriendlySlug, siteUrl } from './slug';

export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface SeoResult {
  checks: SeoCheck[];
  passed: number;
  total: number;
  score: number;
}

/** Everything the 15 checks need — deliberately a plain object so the client can run it live. */
export interface SeoInput {
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  slug: string;
  focusKeyword: string;
  contentMarkdown: string;
  coverImageAlt: string;
  wordCountTarget: number;
  siteHost?: string;
}

function has(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

function isInternal(href: string, host: string): boolean {
  if (href.startsWith('/')) return !href.startsWith('//');
  if (href.startsWith('#')) return false;
  try {
    return new URL(href).host === host;
  } catch {
    return false;
  }
}

function isExternalAuthoritative(href: string, host: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    const u = new URL(href);
    if (u.host === host) return false;
    // Treat any resolvable off-site https link as an outbound citation; http-only
    // and bare IPs are not considered authoritative references.
    return u.protocol === 'https:' && /[a-z]/i.test(u.hostname) && u.hostname.includes('.');
  } catch {
    return false;
  }
}

export function evaluateSeo(input: SeoInput): SeoResult {
  const host = input.siteHost || new URL(siteUrl()).host;
  const md = input.contentMarkdown || '';
  const plain = toPlainText(md);
  const words = countWords(md);
  const headings = extractHeadings(md);
  const images = extractImages(md);
  const links = extractLinks(md);
  const target = input.wordCountTarget || 600;
  const kw = input.focusKeyword.trim();

  const titleLen = input.title.trim().length;
  const metaTitleLen = input.metaTitle.trim().length;
  const metaDescLen = input.metaDescription.trim().length;
  const h2s = headings.filter((h) => h.level === 2);

  let hierarchyOk = true;
  let seenLevel = 1;
  for (const h of headings) {
    if (h.level > seenLevel + 1) hierarchyOk = false;
    seenLevel = h.level;
  }

  const internalLinks = links.filter((l) => isInternal(l.href, host));
  const externalLinks = links.filter((l) => isExternalAuthoritative(l.href, host));
  const imagesMissingAlt = images.filter((i) => !i.alt);

  const checks: SeoCheck[] = [
    {
      id: 'title-length',
      label: 'Title is 30–60 characters',
      passed: titleLen >= 30 && titleLen <= 60,
      detail: `${titleLen} characters`,
    },
    {
      id: 'meta-title-length',
      label: 'Meta title is 30–60 characters',
      passed: metaTitleLen >= 30 && metaTitleLen <= 60,
      detail: `${metaTitleLen} characters`,
    },
    {
      id: 'meta-description-length',
      label: 'Meta description is 120–160 characters',
      passed: metaDescLen >= 120 && metaDescLen <= 160,
      detail: `${metaDescLen} characters`,
    },
    {
      id: 'keyword-in-title',
      label: 'Focus keyword appears in the title',
      passed: has(input.title, kw),
      detail: kw ? `Looking for “${kw}”` : 'No focus keyword set',
    },
    {
      id: 'keyword-in-intro',
      label: 'Focus keyword appears in the first 100 words',
      passed: has(firstWords(md, 100), kw),
      detail: kw ? `Looking for “${kw}”` : 'No focus keyword set',
    },
    {
      id: 'keyword-in-meta-description',
      label: 'Focus keyword appears in the meta description',
      passed: has(input.metaDescription, kw),
      detail: kw ? `Looking for “${kw}”` : 'No focus keyword set',
    },
    {
      id: 'word-count',
      label: `Word count meets the ${target}-word target`,
      passed: words >= target,
      detail: `${words} of ${target} words`,
    },
    {
      id: 'has-h2',
      label: 'At least one H2 heading',
      passed: h2s.length > 0,
      detail: `${h2s.length} H2 heading${h2s.length === 1 ? '' : 's'}`,
    },
    {
      id: 'heading-hierarchy',
      label: 'Heading levels are not skipped',
      passed: headings.length === 0 ? false : hierarchyOk,
      detail: headings.length === 0 ? 'No headings yet' : hierarchyOk ? 'Clean hierarchy' : 'A level is skipped',
    },
    {
      id: 'internal-link',
      label: 'At least one internal link',
      passed: internalLinks.length > 0,
      detail: `${internalLinks.length} internal link${internalLinks.length === 1 ? '' : 's'}`,
    },
    {
      id: 'external-link',
      label: 'At least one external authoritative link',
      passed: externalLinks.length > 0,
      detail: `${externalLinks.length} external link${externalLinks.length === 1 ? '' : 's'}`,
    },
    {
      id: 'cover-alt',
      label: 'Cover image has alt text',
      passed: input.coverImageAlt.trim().length > 0,
      detail: input.coverImageAlt.trim() ? 'Alt text set' : 'Missing',
    },
    {
      id: 'inline-image-alt',
      label: 'Every inline image has alt text',
      passed: images.length === 0 ? true : imagesMissingAlt.length === 0,
      detail:
        images.length === 0
          ? 'No inline images'
          : `${images.length - imagesMissingAlt.length} of ${images.length} have alt text`,
    },
    {
      id: 'slug-friendly',
      label: 'Slug is SEO-friendly',
      passed: isSeoFriendlySlug(input.slug, kw),
      detail: input.slug ? `/${input.slug}` : 'No slug yet',
    },
    {
      id: 'excerpt',
      label: 'Excerpt is filled in',
      passed: input.excerpt.trim().length > 0,
      detail: `${input.excerpt.trim().length} characters`,
    },
  ];

  void plain;
  const passed = checks.filter((c) => c.passed).length;
  return { checks, passed, total: checks.length, score: Math.round((passed / checks.length) * 100) };
}

export function internalLinkCount(md: string, host?: string): number {
  const h = host || new URL(siteUrl()).host;
  return extractLinks(md).filter((l) => isInternal(l.href, h)).length;
}
