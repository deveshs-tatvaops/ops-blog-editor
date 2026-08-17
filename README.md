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
| `npm run test:multi-instance <a> <b>` | Prove two running instances share one database |

Storage is libSQL (`data/blog.db` locally), created and migrated on first run and
seeded with the 15 live services. Images are stored in the database and served by
the `/uploads/[...file]` route — **not** from `public/`, which only serves files
that existed at build time.

## Deploying

Storage is **libSQL** — the SQLite dialect, reachable either as a local file or
as a hosted database over HTTP. That choice is what makes serverless deployment
work, and it is not optional there:

> A serverless host gives every function instance its own filesystem and routes
> consecutive requests to different instances. With a local file, the request
> that saves a post and the request that reads it back talk to **different
> databases** — the save returns 201 and the very next page 404s. Posts, uploads
> and the sitemap all need one shared database.

**Vercel (or any serverless host):**

1. Create a libSQL database — [Turso](https://turso.tech) has a free tier; any
   libSQL server works.
2. Set `TURSO_DATABASE_URL` (`libsql://…`) and `TURSO_AUTH_TOKEN` in the project's
   environment variables.
3. Optionally set `NEXT_PUBLIC_SITE_URL` so canonical URLs, the sitemap and schema
   point at the right host, and `ANTHROPIC_API_KEY` for the AI tools.
4. Deploy. `vercel.json` registers the scheduled-publish job as a daily cron.

Without step 2 the app still boots, but the admin header carries a red banner
saying data will not survive, and `/api/health` reports
`storageIsEphemeral: true` with the fix. **Uploaded and generated images live in
the database too** (`media` table), so they are shared across instances and need
no object storage.

**Anywhere with a real filesystem** (a VM, Fly, Railway, Docker) needs none of
this: leave the variables unset and it uses `data/blog.db`, or point
`BLOG_DB_PATH` at a volume.

`GET /api/health` reports which database the server resolved, whether it is
shared, how many services and images it can see, and whether the image pipeline
works — start there when a deploy misbehaves. `npm run test:multi-instance <urlA>
<urlB>` proves two instances see the same data.

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
in the editor works. The one exception is the cover generator, which falls back to
deterministic branded artwork (still unique per post, chosen by hashing the post's
own text) so the cover-image publish requirement can be satisfied without a key.

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
  db.ts schema.ts posts.ts         libSQL layer, single write path in savePost()
  runtime.ts                       resolves which database this deployment talks to
  seo.ts publish-gate.ts           the two shared engines
  schema-jsonld.ts                 Article + BreadcrumbList + FAQ when present
  media.ts indexing.ts             database-backed images, Search Console Indexing API
  ai/                              prompt, client, similarity
```

`savePost()` is the only write path. It recomputes HTML, word count, reading time,
SEO score, canonical URL, CTA link and cached JSON-LD on every save, so the caches
can never drift from the source Markdown.
