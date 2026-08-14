import { countWords } from './markdown';
import { internalLinkCount } from './seo';
import { LIMITS } from './types';

export interface GateItem {
  id: string;
  label: string;
  passed: boolean;
}

export interface GateResult {
  items: GateItem[];
  blocking: GateItem[];
  canPublish: boolean;
}

export interface GateInput {
  primaryServiceId: number | null;
  title: string;
  slug: string;
  excerpt: string;
  contentMarkdown: string;
  wordCountTarget: number;
  coverImageUrl: string;
  coverImageAlt: string;
  coverPhotoDescription: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
}

/** Alt text falls back to the photo description, then the title. */
export function resolveCoverAlt(input: {
  coverImageAlt: string;
  coverPhotoDescription: string;
  title: string;
}): string {
  return (
    input.coverImageAlt.trim() || input.coverPhotoDescription.trim() || input.title.trim() || ''
  );
}

export function evaluateGate(input: GateInput): GateResult {
  const words = countWords(input.contentMarkdown);
  const target = input.wordCountTarget || LIMITS.defaultWordTarget;
  const metaTitleLen = input.metaTitle.trim().length;
  const metaDescLen = input.metaDescription.trim().length;
  const resolvedAlt = resolveCoverAlt(input);

  const items: GateItem[] = [
    { id: 'primary-service', label: 'Primary service is selected', passed: !!input.primaryServiceId },
    { id: 'title', label: 'Title is filled in', passed: input.title.trim().length > 0 },
    { id: 'slug', label: 'Slug is filled in', passed: input.slug.trim().length > 0 },
    { id: 'excerpt', label: 'Excerpt is filled in', passed: input.excerpt.trim().length > 0 },
    { id: 'content', label: 'Content is not empty', passed: input.contentMarkdown.trim().length > 0 },
    { id: 'word-count', label: `Word count is at least ${target}`, passed: words >= target },
    { id: 'cover-image', label: 'Cover image is set', passed: input.coverImageUrl.trim().length > 0 },
    { id: 'cover-alt', label: 'Cover image has resolved alt text', passed: resolvedAlt.length > 0 },
    {
      id: 'meta-title',
      label: 'Meta title is filled in and within 60 characters',
      passed: metaTitleLen > 0 && metaTitleLen <= LIMITS.metaTitle,
    },
    {
      id: 'meta-description',
      label: 'Meta description is filled in and within 160 characters',
      passed: metaDescLen > 0 && metaDescLen <= LIMITS.metaDescription,
    },
    {
      id: 'internal-link',
      label: 'Content has at least one internal link',
      passed: internalLinkCount(input.contentMarkdown) > 0,
    },
    { id: 'canonical', label: 'Canonical URL is set', passed: input.canonicalUrl.trim().length > 0 },
  ];

  const blocking = items.filter((i) => !i.passed);
  return { items, blocking, canPublish: blocking.length === 0 };
}
