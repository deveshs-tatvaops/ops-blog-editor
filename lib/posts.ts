import { getDb } from './db';
import { countWords, readingTime, renderMarkdown } from './markdown';
import { evaluateGate, resolveCoverAlt } from './publish-gate';
import { buildJsonLd } from './schema-jsonld';
import { evaluateSeo } from './seo';
import { canonicalFor, slugify } from './slug';
import { LIMITS, type Post, type PostStatus, type PostWithService, type Service } from './types';

type Row = Record<string, any>;

/* ------------------------------------------------------------------ services */

export function listServices(): Service[] {
  return getDb()
    .prepare('SELECT * FROM services ORDER BY sort_order, name')
    .all() as Service[];
}

export function getService(id: number | null | undefined): Service | null {
  if (!id) return null;
  return (getDb().prepare('SELECT * FROM services WHERE id = ?').get(id) as Service) || null;
}

export function getServiceBySlug(slug: string): Service | null {
  return (getDb().prepare('SELECT * FROM services WHERE slug = ?').get(slug) as Service) || null;
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

function mapRow(row: Row): Post {
  return {
    ...(row as any),
    tags: parseJsonArray(row.tags),
    secondary_keywords: parseJsonArray(row.secondary_keywords),
    secondary_services: [],
  } as Post;
}

function attachSecondary(post: Post): Post {
  const rows = getDb()
    .prepare('SELECT service_id, pinned FROM post_secondary_services WHERE post_id = ?')
    .all(post.id) as Row[];
  post.secondary_services = rows.map((r) => ({ service_id: r.service_id, pinned: !!r.pinned }));
  return post;
}

export function getPost(id: number): Post | null {
  const row = getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id) as Row | undefined;
  return row ? attachSecondary(mapRow(row)) : null;
}

export interface AdminListItem extends Post {
  service_slug: string | null;
  service_name: string | null;
}

export function listPostsForAdmin(filter?: { status?: PostStatus; q?: string }): AdminListItem[] {
  const clauses: string[] = [];
  const params: any[] = [];
  if (filter?.status) {
    clauses.push('p.status = ?');
    params.push(filter.status);
  }
  if (filter?.q) {
    clauses.push('(p.title LIKE ? OR p.slug LIKE ?)');
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = getDb()
    .prepare(
      `SELECT p.*, s.slug AS service_slug, s.name AS service_name
       FROM posts p LEFT JOIN services s ON s.id = p.primary_service_id
       ${where}
       ORDER BY COALESCE(p.published_at, p.updated_at) DESC`
    )
    .all(...params) as Row[];
  return rows.map((r) => ({ ...(mapRow(r) as any), service_slug: r.service_slug, service_name: r.service_name }));
}

/** Posts listed on a service's blog index: primary OR secondary, pinned first. */
export function listPostsForService(serviceId: number, limit?: number): PostWithService[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, s.slug AS service_slug, s.name AS service_name,
              MAX(CASE WHEN pss.service_id = @sid THEN pss.pinned ELSE 0 END) AS pinned
       FROM posts p
       JOIN services s ON s.id = p.primary_service_id
       LEFT JOIN post_secondary_services pss ON pss.post_id = p.id
       WHERE p.status = 'published'
         AND (p.primary_service_id = @sid
              OR EXISTS (SELECT 1 FROM post_secondary_services x
                         WHERE x.post_id = p.id AND x.service_id = @sid))
       GROUP BY p.id
       ORDER BY pinned DESC, COALESCE(p.published_at, p.created_at) DESC
       ${limit ? 'LIMIT @limit' : ''}`
    )
    .all({ sid: serviceId, limit: limit ?? -1 }) as Row[];
  return rows.map((r) => ({
    ...(mapRow(r) as any),
    service_slug: r.service_slug,
    service_name: r.service_name,
    pinned: !!r.pinned,
  }));
}

/** Resolves a public post URL. Only the primary service's path resolves. */
export function getPublishedPostByPath(serviceSlug: string, slug: string): PostWithService | null {
  const row = getDb()
    .prepare(
      `SELECT p.*, s.slug AS service_slug, s.name AS service_name
       FROM posts p JOIN services s ON s.id = p.primary_service_id
       WHERE s.slug = ? AND p.slug = ? AND p.status IN ('published','internal')`
    )
    .get(serviceSlug, slug) as Row | undefined;
  if (!row) return null;
  const post = attachSecondary(mapRow(row));
  return { ...(post as any), service_slug: row.service_slug, service_name: row.service_name };
}

export function listRelatedPosts(post: PostWithService, limit = 3): PostWithService[] {
  const serviceIds = [post.primary_service_id, ...post.secondary_services.map((s) => s.service_id)]
    .filter((n): n is number => !!n);
  if (!serviceIds.length) return [];
  const placeholders = serviceIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(
      `SELECT p.*, s.slug AS service_slug, s.name AS service_name
       FROM posts p JOIN services s ON s.id = p.primary_service_id
       WHERE p.status = 'published' AND p.id <> ?
         AND (p.primary_service_id IN (${placeholders})
              OR EXISTS (SELECT 1 FROM post_secondary_services x
                         WHERE x.post_id = p.id AND x.service_id IN (${placeholders})))
       GROUP BY p.id
       ORDER BY COALESCE(p.published_at, p.created_at) DESC
       LIMIT ?`
    )
    .all(post.id, ...serviceIds, ...serviceIds, limit) as Row[];
  return rows.map((r) => ({
    ...(mapRow(r) as any),
    service_slug: r.service_slug,
    service_name: r.service_name,
  }));
}

/** Every published (non-internal) post, for sitemap.xml. */
export function listPublishedForSitemap(): PostWithService[] {
  const rows = getDb()
    .prepare(
      `SELECT p.*, s.slug AS service_slug, s.name AS service_name
       FROM posts p JOIN services s ON s.id = p.primary_service_id
       WHERE p.status = 'published'
       ORDER BY COALESCE(p.published_at, p.created_at) DESC`
    )
    .all() as Row[];
  return rows.map((r) => ({
    ...(mapRow(r) as any),
    service_slug: r.service_slug,
    service_name: r.service_name,
  }));
}

/* ------------------------------------------------------------------- writing */

export interface SavePostInput extends Partial<Omit<Post, 'id' | 'tags' | 'secondary_keywords' | 'secondary_services'>> {
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

function uniqueSlug(db: ReturnType<typeof getDb>, serviceId: number | null, slug: string, postId?: number): string {
  if (!slug || !serviceId) return slug;
  const stmt = db.prepare(
    'SELECT id FROM posts WHERE primary_service_id = ? AND slug = ? AND id <> ? LIMIT 1'
  );
  let candidate = slug;
  let n = 2;
  while (stmt.get(serviceId, candidate, postId ?? -1)) {
    const suffix = `-${n++}`;
    candidate = `${slug.slice(0, LIMITS.slug - suffix.length)}${suffix}`;
  }
  return candidate;
}

const clamp = (s: unknown, max: number) => String(s ?? '').slice(0, max);

/**
 * Single write path for the editor. Recomputes every derived field
 * (html, counts, SEO score, canonical, CTA link, schema) so the cache can
 * never drift from the source markdown.
 */
export function savePost(input: SavePostInput): Post {
  const db = getDb();
  const existing = input.id ? getPost(input.id) : null;
  if (input.id && !existing) throw new Error(`Post ${input.id} not found`);

  const merged = {
    title: clamp(input.title ?? existing?.title ?? '', LIMITS.title),
    excerpt: clamp(input.excerpt ?? existing?.excerpt ?? '', LIMITS.excerpt),
    content_markdown: clamp(input.content_markdown ?? existing?.content_markdown ?? '', LIMITS.content),
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

  const primaryService = getService(merged.primary_service_id);

  // Slug: explicit value wins, else derive from the title.
  const rawSlug = clamp(input.slug ?? existing?.slug ?? '', LIMITS.slug);
  const baseSlug = slugify(rawSlug || merged.title, { stripStopwords: !rawSlug });
  const slug = uniqueSlug(db, merged.primary_service_id, baseSlug, existing?.id);

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

  const ctaService = getService(merged.cta_service_id ?? merged.primary_service_id);
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

  // Publishing (now or on a schedule flip) must clear the gate server-side.
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
    if (!gate.canPublish) throw new PublishGateError(gate.blocking.map(({ id, label }) => ({ id, label })));
  }

  const published_at =
    merged.status === 'published'
      ? input.published_at ?? existing?.published_at ?? new Date().toISOString()
      : existing?.published_at ?? null;

  const row = {
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

  const tx = db.transaction(() => {
    let id = existing?.id;
    if (id) {
      db.prepare(
        `UPDATE posts SET
           title=@title, slug=@slug, excerpt=@excerpt, content_markdown=@content_markdown,
           content_html=@content_html, status=@status, published_at=@published_at,
           scheduled_for=@scheduled_for, author_name=@author_name,
           primary_service_id=@primary_service_id, topic_label=@topic_label, tags=@tags,
           focus_keyword=@focus_keyword, secondary_keywords=@secondary_keywords,
           meta_title=@meta_title, meta_description=@meta_description, canonical_url=@canonical_url,
           cover_image_url=@cover_image_url, cover_image_alt=@cover_image_alt,
           cover_photo_description=@cover_photo_description, cover_photo_credit=@cover_photo_credit,
           cta_service_id=@cta_service_id, cta_link_url=@cta_link_url,
           cta_button_label=@cta_button_label, seo_score=@seo_score, word_count=@word_count,
           reading_time_minutes=@reading_time_minutes, word_count_target=@word_count_target,
           last_publish_error=@last_publish_error, updated_at=datetime('now')
         WHERE id=@id`
      ).run({ ...row, id });
    } else {
      const info = db
        .prepare(
          `INSERT INTO posts (
             title, slug, excerpt, content_markdown, content_html, status, published_at,
             scheduled_for, author_name, primary_service_id, topic_label, tags, focus_keyword,
             secondary_keywords, meta_title, meta_description, canonical_url, cover_image_url,
             cover_image_alt, cover_photo_description, cover_photo_credit, cta_service_id,
             cta_link_url, cta_button_label, seo_score, word_count, reading_time_minutes,
             word_count_target, last_publish_error
           ) VALUES (
             @title, @slug, @excerpt, @content_markdown, @content_html, @status, @published_at,
             @scheduled_for, @author_name, @primary_service_id, @topic_label, @tags, @focus_keyword,
             @secondary_keywords, @meta_title, @meta_description, @canonical_url, @cover_image_url,
             @cover_image_alt, @cover_photo_description, @cover_photo_credit, @cta_service_id,
             @cta_link_url, @cta_button_label, @seo_score, @word_count, @reading_time_minutes,
             @word_count_target, @last_publish_error
           )`
        )
        .run(row);
      id = Number(info.lastInsertRowid);
    }

    if (input.secondary_services) {
      db.prepare('DELETE FROM post_secondary_services WHERE post_id = ?').run(id);
      const ins = db.prepare(
        'INSERT OR REPLACE INTO post_secondary_services (post_id, service_id, pinned) VALUES (?,?,?)'
      );
      for (const s of input.secondary_services) {
        if (!s.service_id || s.service_id === merged.primary_service_id) continue;
        ins.run(id, s.service_id, s.pinned ? 1 : 0);
      }
    }
    return id!;
  });

  const id = tx();
  const saved = getPost(id)!;

  // Schema cache is generated from the saved row so it always matches what ships.
  if (primaryService) {
    const jsonld = JSON.stringify(buildJsonLd(saved, primaryService));
    db.prepare('UPDATE posts SET schema_jsonld = ? WHERE id = ?').run(jsonld, id);
    saved.schema_jsonld = jsonld;
  }
  return saved;
}

export function deletePost(id: number): void {
  getDb().prepare('DELETE FROM posts WHERE id = ?').run(id);
}

/** Drafts whose scheduled time has arrived. */
export function listDuePosts(now = new Date()): Post[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM posts
       WHERE status = 'draft' AND scheduled_for IS NOT NULL AND scheduled_for <> ''
         AND scheduled_for <= ?`
    )
    .all(now.toISOString()) as Row[];
  return rows.map((r) => attachSecondary(mapRow(r)));
}

export function flagPublishFailure(id: number, message: string): void {
  getDb().prepare('UPDATE posts SET last_publish_error = ? WHERE id = ?').run(message, id);
}
