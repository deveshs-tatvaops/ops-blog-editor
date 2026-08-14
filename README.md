# TatvaOps Blog Editor

A per-service blog system for `ops.withtatva.ai`: a public blog scoped under each
service path, an admin editor at `/admin/blog`, and one rule that shapes the whole
data model — **one post, one canonical URL**, even when it should appear on several
service pages.

```
/services/<service-slug>/blog            → listing (primary + featured posts)
/services/<service-slug>/blog/<slug>     → the post — resolves ONLY on its primary service
/services/<service-slug>                 → landing page with the "From our blog" widget
/admin/blog                              → editorial list with SEO score badges
/admin/blog/new · /admin/blog/[id]/edit  → the editor
```

## Running it

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY to enable the AI tools
npm run dev                    # http://localhost:3000/admin/blog
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests for the SEO engine, publish gate, slug rules, FAQ extraction |
| `npm run smoke` | End-to-end check against a running server (34 assertions) |
| `npm run db:reset` | Delete the SQLite file; services re-seed on next start |
| `npm run seed:demo` | Publish one finished demo post against a running server |

Storage is SQLite (`data/blog.db`), created and migrated on first run and seeded
with the 15 live services. Uploads land in `data/uploads/` and are served by the
`/uploads/[...file]` route handler — **not** from `public/`, because Next only
serves `public/` files that existed at build time, so runtime uploads would 404
in production.

## Deploying

The app writes a SQLite file and uploaded images to disk. Serverless hosts give
each function a **read-only filesystem except `/tmp`**, so `lib/runtime.ts`
redirects both to `/tmp/ops-blog/` when it detects Vercel or Lambda. That makes a
preview deploy work out of the box — and makes storage **ephemeral**: `/tmp` is
per-instance and wiped on redeploy and between cold starts. The admin header says
so on any deploy where that applies.

**Vercel, as a preview:** import the repo and deploy. No env vars are required;
add `ANTHROPIC_API_KEY` to turn on the AI tools and `NEXT_PUBLIC_SITE_URL` so
canonical URLs, the sitemap and schema point at the right host. `vercel.json`
registers the scheduled-publish job as a daily cron.

**For anything you want to keep**, the SQLite-on-local-disk assumption has to go.
In rough order of effort:

| Option | What changes |
|---|---|
| A host with a persistent volume (Fly, Railway, a VM, Docker) | Nothing — set `BLOG_DB_PATH` and `BLOG_UPLOAD_DIR` to paths on the volume |
| Turso / libSQL | Swap `better-sqlite3` for `@libsql/client` in `lib/db.ts`; the SQL is unchanged |
| Postgres | Rewrite `lib/db.ts` and the queries in `lib/posts.ts`; the schema ports directly |

Uploads need the same treatment — point `BLOG_UPLOAD_DIR` at the volume, or move
`lib/media.ts` to object storage (S3, R2, Vercel Blob) and return those URLs.

`GET /api/health` reports which paths the server resolved, whether the database
opened, whether uploads are writable, and whether the image pipeline works — start
there when a deploy misbehaves.

## One post, one URL

`primary_service_id` decides the canonical URL. `post_secondary_services` is a
join table that *surfaces* the same post on other services' listings and widgets
— it never mints a second URL. Hitting a secondary service's blog path with that
slug returns 404, so the same article can serve many services without duplicate
content.

`status` has three values: `draft` (editor only), `published` (live, listed, in
the sitemap), and `internal` (live URL, `noindex`, excluded from every listing,
widget and the sitemap).

## The SEO score — 15 checks

`lib/seo.ts` is a pure function shared by the client and the server, so the score
in the editor is the score that gets saved. Score = passed ÷ 15 × 100, recomputed
on every keystroke (debounced through React state) and on every save.

Title length · meta title length · meta description length · keyword in title ·
keyword in the first 100 words · keyword in the meta description · word count vs
target · at least one H2 · no skipped heading levels · at least one internal link ·
at least one external authoritative link · cover alt text · alt text on every
inline image · SEO-friendly slug · excerpt filled in.

The word-count target defaults to 600 and is overridable per post for pillar
content; both the score and the gate follow the override.

## The publish gate

`lib/publish-gate.ts` — also shared. The Publish button is disabled and lists the
unmet conditions inline; `savePost()` re-runs the same gate server-side and throws
`PublishGateError` (HTTP 422 with the blocking list), so the API cannot be used to
route around the UI.

Scheduling sets `scheduled_for` and keeps the post a draft.
`GET|POST /api/cron/publish-scheduled` (bearer `CRON_SECRET`) flips due posts and
**re-validates the gate at publish time** — anything that regressed stays a draft
with the reason recorded in `last_publish_error`, shown in the editorial list.

## AI tooling

Every generative call carries the Section 6 writing standard as its system prompt
(`lib/ai/prompt.ts`) — not as documentation, but as the actual prompt. Structured
calls use `output_config.format` with a JSON schema, so responses are parseable by
construction.

| Endpoint | What it does |
|---|---|
| `POST /api/ai/draft` | Full post from title, excerpt, keyword and service — with real internal links |
| `POST /api/ai/refine` | Rewrites the existing draft to the standard, keeping the author's facts |
| `POST /api/ai/fields` | Meta title, meta description, topic label, tags — all or one |
| `POST /api/ai/quality-check` | Itemised issues; passive voice is **flagged, never silently rewritten** |
| `POST /api/ai/plagiarism` | Deterministic 8-gram overlap against published posts, plus a web-search pass |
| `POST /api/ai/internal-links` | Contextual link suggestions, filtered against hallucinated anchors and URLs |
| `POST /api/ai/cover-image` | Art-directs and renders a branded 16:9 WebP, seeded per post so no two match |

Without `ANTHROPIC_API_KEY` these return 503 with a clear message; everything else
in the editor works.

## Media

`POST /api/upload` accepts PNG/JPG/WebP/GIF up to 5MB, enforces 16:9 when
`enforceAspect=16:9`, and compresses to WebP (animated GIFs pass through intact).
Files are content-hashed, so the serving route can cache them immutably.
Inline image insertion blocks until alt text is supplied. Cover alt text resolves
at save time: explicit → photo description → title.

## Layout

```
app/
  admin/blog/…                     editor + editorial list
  services/[service]/blog/…        public listing and post
  api/{posts,ai,upload,cron}/…     API routes
components/editor/                 PostEditor + the four sidebar panels
lib/
  db.ts schema.sql posts.ts        SQLite layer, single write path in savePost()
  seo.ts publish-gate.ts           the two shared engines
  schema-jsonld.ts                 Article + BreadcrumbList + FAQ when present
  media.ts indexing.ts             uploads/WebP, Search Console Indexing API
  ai/                              prompt, client, similarity
```

`savePost()` is the only write path. It recomputes HTML, word count, reading time,
SEO score, canonical URL, CTA link and cached JSON-LD on every save, so the caches
can never drift from the source Markdown.
