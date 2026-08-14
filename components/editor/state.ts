import type { Post, PostStatus, Service } from '@/lib/types';

export interface EditorForm {
  id: number | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  content_markdown: string;
  status: PostStatus;
  scheduled_for: string;
  author_name: string;
  primary_service_id: number | null;
  secondary_services: { service_id: number; pinned: boolean }[];
  topic_label: string;
  tags: string[];
  focus_keyword: string;
  secondary_keywords: string[];
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  canonicalTouched: boolean;
  cover_image_url: string;
  cover_image_alt: string;
  cover_photo_description: string;
  cover_photo_credit: string;
  cta_service_id: number | null | 'auto';
  cta_link_url: string;
  ctaLinkTouched: boolean;
  cta_button_label: string;
  word_count_target: number;
  schema_jsonld: string;
}

export function emptyForm(defaultServiceId: number | null): EditorForm {
  return {
    id: null,
    title: '',
    slug: '',
    slugTouched: false,
    excerpt: '',
    content_markdown: '',
    status: 'draft',
    scheduled_for: '',
    author_name: '',
    primary_service_id: defaultServiceId,
    secondary_services: [],
    topic_label: '',
    tags: [],
    focus_keyword: '',
    secondary_keywords: [],
    meta_title: '',
    meta_description: '',
    canonical_url: '',
    canonicalTouched: false,
    cover_image_url: '',
    cover_image_alt: '',
    cover_photo_description: '',
    cover_photo_credit: '',
    cta_service_id: null,
    cta_link_url: '',
    ctaLinkTouched: false,
    cta_button_label: 'Enquire Now',
    word_count_target: 600,
    schema_jsonld: '',
  };
}

export function formFromPost(post: Post): EditorForm {
  return {
    ...emptyForm(post.primary_service_id),
    id: post.id,
    title: post.title,
    slug: post.slug,
    slugTouched: !!post.slug,
    excerpt: post.excerpt,
    content_markdown: post.content_markdown,
    status: post.status,
    scheduled_for: post.scheduled_for ? toLocalInput(post.scheduled_for) : '',
    author_name: post.author_name,
    primary_service_id: post.primary_service_id,
    secondary_services: post.secondary_services.map((s) => ({ ...s })),
    topic_label: post.topic_label,
    tags: post.tags,
    focus_keyword: post.focus_keyword,
    secondary_keywords: post.secondary_keywords,
    meta_title: post.meta_title,
    meta_description: post.meta_description,
    canonical_url: post.canonical_url,
    canonicalTouched: true,
    cover_image_url: post.cover_image_url,
    cover_image_alt: post.cover_image_alt,
    cover_photo_description: post.cover_photo_description,
    cover_photo_credit: post.cover_photo_credit,
    cta_service_id: post.cta_service_id,
    cta_link_url: post.cta_link_url,
    ctaLinkTouched: !!post.cta_link_url,
    cta_button_label: post.cta_button_label || 'Enquire Now',
    word_count_target: post.word_count_target || 600,
    schema_jsonld: post.schema_jsonld,
  };
}

/** Payload for POST/PUT — strips the UI-only "touched" bookkeeping. */
export function toPayload(form: EditorForm, status?: PostStatus) {
  return {
    title: form.title,
    slug: form.slug,
    excerpt: form.excerpt,
    content_markdown: form.content_markdown,
    status: status ?? form.status,
    scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
    author_name: form.author_name,
    primary_service_id: form.primary_service_id,
    secondary_services: form.secondary_services,
    topic_label: form.topic_label,
    tags: form.tags,
    focus_keyword: form.focus_keyword,
    secondary_keywords: form.secondary_keywords,
    meta_title: form.meta_title,
    meta_description: form.meta_description,
    canonical_url: form.canonical_url,
    cover_image_url: form.cover_image_url,
    cover_image_alt: form.cover_image_alt,
    cover_photo_description: form.cover_photo_description,
    cover_photo_credit: form.cover_photo_credit,
    cta_service_id: form.cta_service_id === 'auto' ? null : form.cta_service_id,
    cta_link_url: form.cta_link_url,
    cta_button_label: form.cta_button_label,
    word_count_target: form.word_count_target,
  };
}

export function serviceById(services: Service[], id: number | null | undefined): Service | null {
  return services.find((s) => s.id === id) ?? null;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** Rough Google SERP pixel width for the title (Arial 20px average glyph widths). */
export function pixelWidth(text: string): number {
  const narrow = new Set('ijltfrI.,:;\'"|!'.split(''));
  const wide = new Set('mwMW@%'.split(''));
  let px = 0;
  for (const ch of text) {
    if (narrow.has(ch)) px += 5;
    else if (wide.has(ch)) px += 16;
    else if (ch === ' ') px += 5.5;
    else if (ch === ch.toUpperCase() && /[A-Z]/.test(ch)) px += 13;
    else px += 10;
  }
  return Math.round(px);
}
