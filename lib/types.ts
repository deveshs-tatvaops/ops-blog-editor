export type PostStatus = 'draft' | 'published' | 'internal';

export interface Service {
  id: number;
  slug: string;
  name: string;
  cta_default_url: string;
  sort_order: number;
}

export interface SecondaryService {
  service_id: number;
  pinned: boolean;
}

/** Shape shared by the editor client, the API and the public pages. */
export interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content_markdown: string;
  content_html: string;
  status: PostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  author_name: string;
  primary_service_id: number | null;
  topic_label: string;
  tags: string[];
  focus_keyword: string;
  secondary_keywords: string[];
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  cover_image_url: string;
  cover_image_alt: string;
  cover_photo_description: string;
  cover_photo_credit: string;
  cta_service_id: number | null;
  cta_link_url: string;
  cta_button_label: string;
  schema_jsonld: string;
  seo_score: number;
  word_count: number;
  reading_time_minutes: number;
  word_count_target: number;
  last_publish_error: string;
  created_at: string;
  updated_at: string;
  secondary_services: SecondaryService[];
}

/** A post joined with the service names needed for listing/rendering. */
export interface PostWithService extends Post {
  service_slug: string;
  service_name: string;
  pinned?: boolean;
}

export const LIMITS = {
  title: 200,
  slug: 220,
  excerpt: 300,
  content: 150_000,
  metaTitle: 60,
  metaDescription: 160,
  tags: 10,
  secondaryKeywords: 3,
  defaultWordTarget: 600,
} as const;
