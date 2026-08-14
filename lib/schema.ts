/**
 * Schema as a module rather than a .sql file read at runtime — serverless
 * bundles only trace imported modules, so a stray readFileSync would break
 * the first request on Vercel.
 */
export const SCHEMA_SQL = `PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS services (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  cta_default_url TEXT NOT NULL DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  title                    TEXT NOT NULL DEFAULT '',
  slug                     TEXT NOT NULL DEFAULT '',
  excerpt                  TEXT NOT NULL DEFAULT '',
  content_markdown         TEXT NOT NULL DEFAULT '',
  content_html             TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','published','internal')),
  published_at             TEXT,
  scheduled_for            TEXT,
  author_name              TEXT NOT NULL DEFAULT '',
  primary_service_id       INTEGER REFERENCES services(id) ON DELETE RESTRICT,
  topic_label              TEXT NOT NULL DEFAULT '',
  tags                     TEXT NOT NULL DEFAULT '[]',
  focus_keyword            TEXT NOT NULL DEFAULT '',
  secondary_keywords       TEXT NOT NULL DEFAULT '[]',
  meta_title               TEXT NOT NULL DEFAULT '',
  meta_description         TEXT NOT NULL DEFAULT '',
  canonical_url            TEXT NOT NULL DEFAULT '',
  cover_image_url          TEXT NOT NULL DEFAULT '',
  cover_image_alt          TEXT NOT NULL DEFAULT '',
  cover_photo_description  TEXT NOT NULL DEFAULT '',
  cover_photo_credit       TEXT NOT NULL DEFAULT '',
  cta_service_id           INTEGER REFERENCES services(id) ON DELETE SET NULL,
  cta_link_url             TEXT NOT NULL DEFAULT '',
  cta_button_label         TEXT NOT NULL DEFAULT 'Enquire Now',
  schema_jsonld            TEXT NOT NULL DEFAULT '',
  seo_score                INTEGER NOT NULL DEFAULT 0,
  word_count               INTEGER NOT NULL DEFAULT 0,
  reading_time_minutes     INTEGER NOT NULL DEFAULT 0,
  word_count_target        INTEGER NOT NULL DEFAULT 600,
  last_publish_error       TEXT NOT NULL DEFAULT '',
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One canonical URL per post: the slug is unique inside its primary service namespace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_service_slug
  ON posts (primary_service_id, slug)
  WHERE slug <> '';

CREATE INDEX IF NOT EXISTS idx_posts_status_published
  ON posts (status, published_at DESC);

CREATE TABLE IF NOT EXISTS post_secondary_services (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  pinned     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_pss_service ON post_secondary_services (service_id);
`;
