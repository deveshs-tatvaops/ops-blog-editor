import type { Row } from '@libsql/client';
import { all, batch, one, run } from './db';
import { countWords, readingTime, renderMarkdown } from './markdown';
import { evaluateGate, resolveCoverAlt } from './publish-gate';
import { buildJsonLd } from './schema-jsonld';
import { evaluateSeo } from './seo';
import { canonicalFor, slugify } from './slug';
import { LIMITS, type Post, type PostStatus, type PostWithService, type Service } from './types';

/* ------------------------------------------------------------------ services */

export async function listServices(): Promise<Service[]> {
  const rows = await all('SELECT * FROM services ORDER BY sort_order, name');
  return rows as unknown as Service[];
}

export async function getService(id: number | null | undefined): Promise<Service | null> {
  if (!id) return null;
  const row = await one('SELECT * FROM services WHERE id = ?', [id]);
  return (row as unknown as Service) ?? null;
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const row = await one('SELECT * FROM services WHERE slug = ?', [slug]);
  return (row as unknown as Service) ?? null;
}

/* --------------------------------------------------------------------- posts */

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** libSQL returns integers as `number | bigint`; normalise before they escape. */
function num(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function mapRow(row: Row): Post {
  const r = row as unknown as Record<string, unknown>;
  return {
    ...(r as unknown as Post),
    id: num(r.id),
    primary_service_id: r.primary_service_id == null ? null : num(r.primary_service_id),
    cta_service_id: r.cta_service_id == null ? null : num(r.cta_service_id),
    seo_score: num(r.seo_score),
    word_count: num(r.word_count),
    reading_time_minutes: num(r.reading_time_minutes),
    word_count_target: num(r.word_count_target),
    tags: parseJsonArray(r.tags),
    secondary_keywords: parseJsonArray(r.secondary_keywords),
    secondary_services: [],
  };
}

async function attachSecondary(post: Post): Promise<Post> {
  const rows = await all('SELECT service_id, pinned FROM post_secondary_services WHERE post_id = ?', [
    post.id,
  ]);
  post.secondary_services = rows.map((r) => ({
    service_id: num(r.service_id),
    pinned: num(r.pinned) === 1,
  }));
  return post;
}

export async function getPost(id: number): Promise<Post | null> {
  if (!Number.isFinite(id)) return null;
  const row = await one('SELECT * FROM posts WHERE id = ?', [id]);
  return row ? attachSecondary(mapRow(row)) : null;
}

export interface AdminListItem extends Post {
  service_slug: string | null;
  service_name: string | null;
}

export async function listPostsForAdmin(filter?: {
  status?: PostStatus;
  q?: string;
}): Promise<AdminListItem[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter?.status) {
    clauses.push('p.status = ?');
    params.push(filter.status);
  }
  if (filter?.q) {
    clauses.push('(p.title LIKE ? OR p.slug LIKE ?)');
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await all(
    `SELECT p.*, s.slug AS service_slug, s.name AS service_name
     FROM posts p LEFT JOIN services s ON s.id = p.primary_service_id
     ${where}
     ORDER BY COALESCE(p.published_at, p.updated_at) DESC`,
    params
  );

  const posts: AdminListItem[] = [];
  for (const r of rows) {
    const post = await attachSecondary(mapRow(r));
    posts.push({
      ...(post as AdminListItem),
      service_slug: (r.service_slug as string) ?? null,
      service_name: (r.service_name as string) ?? null,
    });
  }
  return posts;
}

/** Posts listed on a service's blog index: primary OR secondary, pinned first. */
export async function listPostsForService(
  serviceId: number,
  limit?: number
): Promise<PostWithService[]> {
  const rows = await all(
    `SELECT p.*, s.slug AS service_slug, s.name AS service_name,
            MAX(CASE WHEN pss.service_id = ?1 THEN pss.pinned ELSE 0 END) AS pinned
     FROM posts p
     JOIN services s ON s.id = p.primary_service_id
     LEFT JOIN post_secondary_services pss ON pss.post_id = p.id
     WHERE p.status = 'published'
       AND (p.primary_service_id = ?1
            OR EXISTS (SELECT 1 FROM post_secondary_services x
                       WHERE x.post_id = p.id AND x.service_id = ?1))
     GROUP BY p.id, s.slug, s.name
     ORDER BY pinned DESC, COALESCE(p.published_at, p.created_at) DESC
     ${limit ? 'LIMIT ?2' : ''}`,
    limit ? [serviceId, limit] : [serviceId]
  );

  return rows.map((r) => ({
    ...(mapRow(r) as PostWithService),
    service_slug: r.service_slug as string,
    service_name: r.service_name as string,
    pinned: num(r.pinned) === 1,
  }));
}

/** Resolves a public post URL. Only the primary service's path resolves. */
export async function getPublishedPostByPath(
  serviceSlug: string,
  slug: string
): Promise<PostWithService | null> {
  const row = await one(
    `SELECT p.*, s.slug AS service_slug, s.name AS service_name
     FROM posts p JOIN services s ON s.id = p.primary_service_id
     WHERE s.slug = ? AND p.slug = ? AND p.status IN ('published','internal')`,
    [serviceSlug, slug]
  );
  if (!row) return null;
  const post = await attachSecondary(mapRow(row));
  return {
    ...(post as PostWithService),
    service_slug: row.service_slug as string,
    service_name: row.service_name as string,
  };
}

export async function listRelatedPosts(
  post: PostWithService,
  limit = 3
): Promise<PostWithService[]> {
  const serviceIds = [post.primary_service_id, ...post.secondary_services.map((s) => s.service_id)]
    .filter((n): n is number => !!n);
  if (!serviceIds.length) return [];

  const placeholders = serviceIds.map(() => '?').join(',');
  const rows = await all(
    `SELECT p.*, s.slug AS service_slug, s.name AS service_name
     FROM posts p JOIN services s ON s.id = p.primary_service_id
     WHERE p.status = 'published' AND p.id <> ?
       AND (p.primary_service_id IN (${placeholders})
            OR EXISTS (SELECT 1 FROM post_secondary_services x
                       WHERE x.post_id = p.id AND x.service_id IN (${placeholders})))
     GROUP BY p.id, s.slug, s.name
     ORDER BY COALESCE(p.published_at, p.created_at) DESC
     LIMIT ?`,
    [post.id, ...serviceIds, ...serviceIds, limit]
  );

  return rows.map((r) => ({
    ...(mapRow(r) as PostWithService),
    service_slug: r.service_slug as string,
    service_name: r.service_name as string,
  }));
}

/** Every published (non-internal) post, for sitemap.xml. */
export async function listPublishedForSitemap(): Promise<PostWithService[]> {
  const rows = await all(
    `SELECT p.*, s.slug AS service_slug, s.name AS service_name
     FROM posts p JOIN services s ON s.id = p.primary_service_id
     WHERE p.status = 'published'
     ORDER BY COALESCE(p.published_at, p.created_at) DESC`
  );
  return rows.map((r) => ({
    ...(mapRow(r) as PostWithService),
    service_slug: r.service_slug as string,
    service_name: r.service_name as string,
  }));
}

/* ------------------------------------------------------------------- writing */

export interface SavePostInput
  extends Partial<Omit<Post, 'id' | 'tags' | 'secondary_keywords' | 'secondary_services'>> {
  id?: number;
  tags?: string[];
  secondary_keywords?: string[];
  secondary_services?: { service_id: number; pinned?: boolean }[];
}

export class PublishGateError extends Error {
  constructor(public blocking: { id: string; label: string }[]) {
    super('Publish gate not satisfied');
    this.name = 'PublishGateError';
  }
}

async function uniqueSlug(
  serviceId: number | null,
  slug: string,
  postId?: number
): Promise<string> {
  if (!slug || !serviceId) return slug;
  let candidate = slug;
  let n = 2;
  for (;;) {
    const clash = await one(
      'SELECT id FROM posts WHERE primary_service_id = ? AND slug = ? AND id <> ? LIMIT 1',
      [serviceId, candidate, postId ?? -1]
    );
    if (!clash) return candidate;
    const suffix = `-${n++}`;
    candidate = `${slug.slice(0, LIMITS.slug - suffix.length)}${suffix}`;
  }
}

const clamp = (s: unknown, max: number) => String(s ?? '').slice(0, max);

/**
 * Single write path for the editor. Recomputes every derived field (html,
 * counts, SEO score, canonical, CTA link, schema) so the caches can never
 * drift from the source markdown.
 */
export async function savePost(input: SavePostInput): Promise<Post> {
  const existing = input.id ? await getPost(input.id) : null;
  if (input.id && !existing) throw new Error(`Post ${input.id} not found`);

  const merged = {
    title: clamp(input.title ?? existing?.title ?? '', LIMITS.title),
    excerpt: clamp(input.excerpt ?? existing?.excerpt ?? '', LIMITS.excerpt),
    content_markdown: clamp(
      input.content_markdown ?? existing?.content_markdown ?? '',
      LIMITS.content
    ),
    status: (input.status ?? existing?.status ?? 'draft') as PostStatus,
    scheduled_for: input.scheduled_for ?? existing?.scheduled_for ?? null,
    author_name: input.author_name ?? existing?.author_name ?? '',
    primary_service_id: input.primary_service_id ?? existing?.primary_service_id ?? null,
    topic_label: input.topic_label ?? existing?.topic_label ?? '',
    tags: (input.tags ?? existing?.tags ?? []).slice(0, LIMITS.tags),
    focus_keyword: input.focus_keyword ?? existing?.focus_keyword ?? '',
    secondary_keywords: (input.secondary_keywords ?? existing?.secondary_keywords ?? []).slice(
      0,
      LIMITS.secondaryKeywords
    ),
    meta_title: clamp(input.meta_title ?? existing?.meta_title ?? '', LIMITS.metaTitle),
    meta_description: clamp(
      input.meta_description ?? existing?.meta_description ?? '',
      LIMITS.metaDescription
    ),
    cover_image_url: input.cover_image_url ?? existing?.cover_image_url ?? '',
    cover_photo_description: input.cover_photo_description ?? existing?.cover_photo_description ?? '',
    cover_photo_credit: input.cover_photo_credit ?? existing?.cover_photo_credit ?? '',
    cta_service_id: input.cta_service_id ?? existing?.cta_service_id ?? null,
    cta_button_label: input.cta_button_label ?? existing?.cta_button_label ?? 'Enquire Now',
    word_count_target: input.word_count_target ?? existing?.word_count_target ?? LIMITS.defaultWordTarget,
  };

  const primaryService = await getService(merged.primary_service_id);

  // Slug: explicit value wins, else derive from the title.
  const rawSlug = clamp(input.slug ?? existing?.slug ?? '', LIMITS.slug);
  const baseSlug = slugify(rawSlug || merged.title, { stripStopwords: !rawSlug });
  const slug = await uniqueSlug(merged.primary_service_id, baseSlug, existing?.id);

  // Alt text falls back to photo description, then title, at save time.
  const cover_image_alt =
    (input.cover_image_alt ?? existing?.cover_image_alt ?? '').trim() ||
    resolveCoverAlt({
      coverImageAlt: '',
      coverPhotoDescription: merged.cover_photo_description,
      title: merged.title,
    });

  const canonical_url =
    (input.canonical_url ?? existing?.canonical_url ?? '').trim() ||
    (primaryService && slug ? canonicalFor(primaryService.slug, slug) : '');

  const ctaService = await getService(merged.cta_service_id ?? merged.primary_service_id);
  const cta_link_url =
    (input.cta_link_url ?? existing?.cta_link_url ?? '').trim() || ctaService?.cta_default_url || '';

  const word_count = countWords(merged.content_markdown);
  const reading_time_minutes = readingTime(word_count);
  const content_html = renderMarkdown(merged.content_markdown);
  const { score } = evaluateSeo({
    title: merged.title,
    metaTitle: merged.meta_title,
    metaDescription: merged.meta_description,
    excerpt: merged.excerpt,
    slug,
    focusKeyword: merged.focus_keyword,
    contentMarkdown: merged.content_markdown,
    coverImageAlt: cover_image_alt,
    wordCountTarget: merged.word_count_target,
  });

  // Publishing (now, or via the scheduler) must clear the gate server-side.
  if (merged.status === 'published') {
    const gate = evaluateGate({
      primaryServiceId: merged.primary_service_id,
      title: merged.title,
      slug,
      excerpt: merged.excerpt,
      contentMarkdown: merged.content_markdown,
      wordCountTarget: merged.word_count_target,
      coverImageUrl: merged.cover_image_url,
      coverImageAlt: cover_image_alt,
      coverPhotoDescription: merged.cover_photo_description,
      metaTitle: merged.meta_title,
      metaDescription: merged.meta_description,
      canonicalUrl: canonical_url,
    });
    if (!gate.canPublish) {
      throw new PublishGateError(gate.blocking.map(({ id, label }) => ({ id, label })));
    }
  }

  const published_at =
    merged.status === 'published'
      ? input.published_at ?? existing?.published_at ?? new Date().toISOString()
      : existing?.published_at ?? null;

  const values = {
    title: merged.title,
    slug,
    excerpt: merged.excerpt,
    content_markdown: merged.content_markdown,
    content_html,
    status: merged.status,
    published_at,
    scheduled_for: merged.scheduled_for,
    author_name: merged.author_name,
    primary_service_id: merged.primary_service_id,
    topic_label: merged.topic_label,
    tags: JSON.stringify(merged.tags),
    focus_keyword: merged.focus_keyword,
    secondary_keywords: JSON.stringify(merged.secondary_keywords),
    meta_title: merged.meta_title,
    meta_description: merged.meta_description,
    canonical_url,
    cover_image_url: merged.cover_image_url,
    cover_image_alt,
    cover_photo_description: merged.cover_photo_description,
    cover_photo_credit: merged.cover_photo_credit,
    cta_service_id: merged.cta_service_id,
    cta_link_url,
    cta_button_label: merged.cta_button_label,
    seo_score: score,
    word_count,
    reading_time_minutes,
    word_count_target: merged.word_count_target,
    last_publish_error: input.last_publish_error ?? '',
  };

  const columns = Object.keys(values) as (keyof typeof values)[];
  const args = columns.map((c) => values[c] as string | number | null);

  let id: number;
  if (existing) {
    await run(
      `UPDATE posts SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now')
       WHERE id = ?`,
      [...args, existing.id]
    );
    id = existing.id;
  } else {
    const row = await one(
      `INSERT INTO posts (${columns.join(', ')})
       VALUES (${columns.map(() => '?').join(', ')})
       RETURNING id`,
      args
    );
    id = num(row?.id);
  }

  if (input.secondary_services) {
    const rows = input.secondary_services.filter(
      (s) => s.service_id && s.service_id !== merged.primary_service_id
    );
    await batch([
      { sql: 'DELETE FROM post_secondary_services WHERE post_id = ?', args: [id] },
      ...rows.map((s) => ({
        sql: 'INSERT OR REPLACE INTO post_secondary_services (post_id, service_id, pinned) VALUES (?,?,?)',
        args: [id, s.service_id, s.pinned ? 1 : 0] as (string | number)[],
      })),
    ]);
  }

  const saved = (await getPost(id))!;

  // Schema cache is generated from the saved row, so it always matches what ships.
  if (primaryService) {
    const jsonld = JSON.stringify(buildJsonLd(saved, primaryService));
    await run('UPDATE posts SET schema_jsonld = ? WHERE id = ?', [jsonld, id]);
    saved.schema_jsonld = jsonld;
  }
  return saved;
}

export async function deletePost(id: number): Promise<void> {
  await run('DELETE FROM posts WHERE id = ?', [id]);
}

/** Drafts whose scheduled time has arrived. */
export async function listDuePosts(now = new Date()): Promise<Post[]> {
  const rows = await all(
    `SELECT * FROM posts
     WHERE status = 'draft' AND scheduled_for IS NOT NULL AND scheduled_for <> ''
       AND scheduled_for <= ?`,
    [now.toISOString()]
  );
  return Promise.all(rows.map((r) => attachSecondary(mapRow(r))));
}

export async function flagPublishFailure(id: number, message: string): Promise<void> {
  await run('UPDATE posts SET last_publish_error = ? WHERE id = ?', [message, id]);
}
