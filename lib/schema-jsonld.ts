import { extractHeadings, toPlainText } from './markdown';
import { canonicalFor, siteUrl } from './slug';
import type { Post, Service } from './types';

export interface FaqPair {
  question: string;
  answer: string;
}

/**
 * Pulls FAQ pairs out of the draft. Recognises either an "## FAQ" section whose
 * H3s are the questions, or bare "### Question?" headings anywhere in the post.
 */
export function extractFaq(md: string): FaqPair[] {
  const lines = (md || '').split('\n');
  const pairs: FaqPair[] = [];
  let inFaqSection = false;
  let current: FaqPair | null = null;

  const flush = () => {
    if (current && current.answer.trim()) pairs.push({ ...current, answer: current.answer.trim() });
    current = null;
  };

  for (const line of lines) {
    const h = /^(#{2,4})\s+(.*)$/.exec(line.trim());
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      if (level === 2) {
        flush();
        inFaqSection = /^(faq|faqs|frequently asked questions|common questions)\b/i.test(text);
        continue;
      }
      if (level >= 3) {
        flush();
        if (inFaqSection || text.endsWith('?')) current = { question: text, answer: '' };
        continue;
      }
    }
    if (current) current.answer += ' ' + toPlainText(line);
  }
  flush();
  return pairs.filter((p) => p.question.length > 3);
}

export function buildJsonLd(post: Post, service: Service): Record<string, unknown>[] {
  const url = post.canonical_url || canonicalFor(service.slug, post.slug);
  const base = siteUrl();
  const alt = post.cover_image_alt || post.cover_photo_description || post.title;

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: (post.meta_title || post.title).slice(0, 110),
    description: post.meta_description || post.excerpt,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: { '@type': post.author_name ? 'Person' : 'Organization', name: post.author_name || 'TatvaOps' },
    publisher: {
      '@type': 'Organization',
      name: 'TatvaOps',
      logo: { '@type': 'ImageObject', url: `${base}/logo-mark.svg` },
    },
    keywords: [post.focus_keyword, ...post.secondary_keywords, ...post.tags].filter(Boolean).join(', '),
    articleSection: post.topic_label || service.name,
    wordCount: post.word_count,
  };
  if (post.cover_image_url) {
    article.image = {
      '@type': 'ImageObject',
      url: post.cover_image_url.startsWith('http') ? post.cover_image_url : `${base}${post.cover_image_url}`,
      description: alt,
      ...(post.cover_photo_credit ? { creditText: post.cover_photo_credit } : {}),
    };
  }

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: 'Services', item: `${base}/services` },
      { '@type': 'ListItem', position: 3, name: service.name, item: `${base}/services/${service.slug}` },
      { '@type': 'ListItem', position: 4, name: 'Blog', item: `${base}/services/${service.slug}/blog` },
      { '@type': 'ListItem', position: 5, name: post.title, item: url },
    ],
  };

  const out: Record<string, unknown>[] = [article, breadcrumb];

  const faq = extractFaq(post.content_markdown);
  if (faq.length) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  }
  return out;
}

/** Used by the editor's outline hints. */
export function headingOutline(md: string) {
  return extractHeadings(md);
}
