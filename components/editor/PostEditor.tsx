'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ContentEditor } from './ContentEditor';
import { CoverImagePanel } from './CoverImagePanel';
import { CtaPanel } from './CtaPanel';
import { DetailsPanel } from './DetailsPanel';
import { SeoPanel } from './SeoPanel';
import { StatusPanel } from './StatusPanel';
import { emptyForm, formFromPost, serviceById, toPayload, type EditorForm } from './state';
import { Counter, Field, useToast } from './ui';
import { evaluateGate } from '@/lib/publish-gate';
import { evaluateSeo } from '@/lib/seo';
import { canonicalFor, slugify } from '@/lib/slug';
import { LIMITS, type Post, type PostStatus, type Service } from '@/lib/types';

export function PostEditor({ services, post }: { services: Service[]; post: Post | null }) {
  const router = useRouter();
  const { show, node: toastNode } = useToast();
  const [form, setForm] = useState<EditorForm>(() =>
    post ? formFromPost(post) : emptyForm(null)
  );
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [busyField, setBusyField] = useState<string | null>(null);
  const [schemaBusy, setSchemaBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  function set<K extends keyof EditorForm>(key: K, value: EditorForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const primaryService = serviceById(services, form.primary_service_id);

  // Slug tracks the title until the author edits it by hand.
  useEffect(() => {
    if (form.slugTouched) return;
    const next = slugify(form.title, { stripStopwords: true });
    setForm((f) => (f.slug === next ? f : { ...f, slug: next }));
  }, [form.title, form.slugTouched]);

  // Canonical follows primary service + slug until overridden.
  useEffect(() => {
    if (form.canonicalTouched) return;
    const next = primaryService && form.slug ? canonicalFor(primaryService.slug, form.slug) : '';
    setForm((f) => (f.canonical_url === next ? f : { ...f, canonical_url: next }));
  }, [primaryService, form.slug, form.canonicalTouched]);

  // CTA link follows the CTA service (or the primary service) until overridden.
  useEffect(() => {
    if (form.ctaLinkTouched) return;
    const id = form.cta_service_id === 'auto' || !form.cta_service_id ? form.primary_service_id : form.cta_service_id;
    const svc = serviceById(services, id);
    const next = svc?.cta_default_url ?? '';
    setForm((f) => (f.cta_link_url === next ? f : { ...f, cta_link_url: next }));
  }, [form.cta_service_id, form.primary_service_id, form.ctaLinkTouched, services]);

  const seo = useMemo(
    () =>
      evaluateSeo({
        title: form.title,
        metaTitle: form.meta_title,
        metaDescription: form.meta_description,
        excerpt: form.excerpt,
        slug: form.slug,
        focusKeyword: form.focus_keyword,
        contentMarkdown: form.content_markdown,
        coverImageAlt:
          form.cover_image_alt.trim() || form.cover_photo_description.trim() || form.title.trim(),
        wordCountTarget: form.word_count_target,
      }),
    [form]
  );

  const gate = useMemo(
    () =>
      evaluateGate({
        primaryServiceId: form.primary_service_id,
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        contentMarkdown: form.content_markdown,
        wordCountTarget: form.word_count_target,
        coverImageUrl: form.cover_image_url,
        coverImageAlt: form.cover_image_alt,
        coverPhotoDescription: form.cover_photo_description,
        metaTitle: form.meta_title,
        metaDescription: form.meta_description,
        canonicalUrl: form.canonical_url,
      }),
    [form]
  );

  const aiReady =
    form.title.trim().length > 0 && form.content_markdown.trim().length >= 20
      ? null
      : 'Add a title and at least 20 characters of content first.';

  async function persist(status?: PostStatus) {
    const isPublish = status === 'published';
    setSaving(isPublish ? 'publish' : 'draft');
    try {
      const url = form.id ? `/api/posts/${form.id}` : '/api/posts';
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPayload(form, status)),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.blocking) {
          show('error', `Publish blocked: ${data.blocking.map((b: any) => b.label).join(', ')}`);
        } else {
          show('error', data.error || 'Save failed');
        }
        return null;
      }
      const saved: Post = data.post;
      setForm((f) => ({
        ...formFromPost(saved),
        slugTouched: f.slugTouched,
        canonicalTouched: f.canonicalTouched,
        ctaLinkTouched: f.ctaLinkTouched,
        cta_service_id: f.cta_service_id,
      }));
      setLastSaved(new Date().toLocaleTimeString());
      show('success', isPublish ? 'Published' : 'Draft saved');
      if (!post) router.replace(`/admin/blog/${saved.id}/edit`);
      router.refresh();
      return saved;
    } catch (err) {
      show('error', err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(null);
    }
  }

  async function handlePublish() {
    if (form.scheduled_for) {
      // Scheduled posts stay drafts; the cron job flips them after re-validating the gate.
      const saved = await persist('draft');
      if (saved) show('info', `Scheduled for ${new Date(form.scheduled_for).toLocaleString()}`);
      return;
    }
    await persist('published');
  }

  async function callAi(endpoint: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/ai/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI request failed');
    return data;
  }

  const aiContext = () => ({
    title: form.title,
    excerpt: form.excerpt,
    focus_keyword: form.focus_keyword,
    secondary_keywords: form.secondary_keywords,
    service_name: primaryService?.name ?? '',
    service_slug: primaryService?.slug ?? '',
    content_markdown: form.content_markdown,
    word_count_target: form.word_count_target,
  });

  async function generateDraft() {
    setAiBusy('draft');
    try {
      const data = await callAi('draft', aiContext());
      set('content_markdown', data.content_markdown);
      show('success', 'Draft generated');
    } catch (err) {
      show('error', err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setAiBusy(null);
    }
  }

  async function refine() {
    setAiBusy('refine');
    try {
      const data = await callAi('refine', aiContext());
      set('content_markdown', data.content_markdown);
      show('success', 'Draft refined');
    } catch (err) {
      show('error', err instanceof Error ? err.message : 'Refine failed');
    } finally {
      setAiBusy(null);
    }
  }

  async function generateFields(fields: string[]) {
    setBusyField(fields.length > 1 ? 'all' : fields[0]);
    try {
      const data = await callAi('fields', { ...aiContext(), fields });
      setForm((f) => ({
        ...f,
        meta_title: data.fields.meta_title ?? f.meta_title,
        meta_description: data.fields.meta_description ?? f.meta_description,
        topic_label: data.fields.topic_label ?? f.topic_label,
        tags: data.fields.tags ?? f.tags,
      }));
      show('success', 'Fields generated');
    } catch (err) {
      show('error', err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusyField(null);
    }
  }

  async function createSchema() {
    if (!form.id) {
      show('info', 'Save the post once first — schema is generated from the saved post.');
      return;
    }
    setSchemaBusy(true);
    try {
      const saved = await persist();
      if (saved) show('success', 'Schema markup generated and cached');
    } finally {
      setSchemaBusy(false);
    }
  }

  async function generateCover() {
    setCoverBusy(true);
    try {
      const data = await callAi('cover-image', aiContext());
      setForm((f) => ({
        ...f,
        cover_image_url: data.url,
        cover_image_alt: f.cover_image_alt || data.alt || '',
        cover_photo_description: f.cover_photo_description || data.caption || '',
        cover_photo_credit: f.cover_photo_credit || 'Illustration generated for TatvaOps',
      }));
      show('success', 'Cover image generated');
    } catch (err) {
      show('error', err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setCoverBusy(false);
    }
  }

  const slugPrefix = primaryService
    ? `/services/${primaryService.slug}/blog/`
    : '/services/<pick a service>/blog/';

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{post ? 'Edit post' : 'New post'}</p>
          <h1 className="section-heading mt-1">{form.title || 'Untitled post'}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="chip">SEO {seo.score}</span>
          <span className="chip capitalize">{form.status}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[65fr_35fr]">
        <div className="space-y-6">
          <section className="card space-y-5 p-5">
            <Field label="Post title" counter={<Counter value={form.title.length} max={LIMITS.title} />}>
              <input
                className="input font-display text-lg font-semibold"
                value={form.title}
                maxLength={LIMITS.title}
                placeholder="How much do home interiors cost in Bangalore?"
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>

            <Field
              label="URL slug"
              counter={<Counter value={form.slug.length} max={LIMITS.slug} />}
              hint={`Final URL: ${slugPrefix}${form.slug || '…'}`}
            >
              <div className="flex items-stretch overflow-hidden rounded-xl border border-line focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-100">
                <span className="flex items-center whitespace-nowrap bg-cream-50 px-3 text-xs text-ink-faint">
                  {slugPrefix}
                </span>
                <input
                  className="w-full border-0 px-2 py-2.5 text-sm outline-none"
                  value={form.slug}
                  maxLength={LIMITS.slug}
                  onChange={(e) => {
                    set('slug', e.target.value);
                    set('slugTouched', true);
                  }}
                />
              </div>
            </Field>

            <Field
              label="Excerpt"
              counter={<Counter value={form.excerpt.length} max={LIMITS.excerpt} />}
              hint="Shown on blog listing cards and service page widgets"
            >
              <textarea
                className="textarea"
                rows={3}
                value={form.excerpt}
                maxLength={LIMITS.excerpt}
                onChange={(e) => set('excerpt', e.target.value)}
              />
            </Field>

            <Field label="Canonical URL" hint="Auto-filled from the primary service and slug. Override if needed.">
              <input
                className="input"
                value={form.canonical_url}
                onChange={(e) => {
                  set('canonical_url', e.target.value);
                  set('canonicalTouched', true);
                }}
              />
            </Field>
          </section>

          <CoverImagePanel
            form={form}
            set={set}
            onGenerateImage={generateCover}
            generating={coverBusy}
            generateDisabledReason={aiReady}
          />

          <ContentEditor
            value={form.content_markdown}
            onChange={(v) => set('content_markdown', v)}
            onGenerateDraft={generateDraft}
            onRefine={refine}
            aiBusy={aiBusy}
            disabledReason={form.title.trim() ? null : 'Add a title first.'}
          />
        </div>

        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <StatusPanel
            status={form.status}
            onStatusChange={(s) => set('status', s)}
            scheduledFor={form.scheduled_for}
            onScheduledChange={(v) => set('scheduled_for', v)}
            gate={gate}
            saving={saving}
            onSaveDraft={() => persist(form.status === 'published' ? 'draft' : form.status)}
            onPublish={handlePublish}
            lastSaved={lastSaved}
            publicUrl={
              post && post.status !== 'draft' && primaryService
                ? `/services/${primaryService.slug}/blog/${form.slug}`
                : null
            }
          />
          <SeoPanel
            form={form}
            set={set}
            seo={seo}
            service={primaryService}
            onCreateSchema={createSchema}
            schemaBusy={schemaBusy}
          />
          <DetailsPanel
            form={form}
            set={set}
            services={services}
            onGenerateAll={() => generateFields(['meta_title', 'meta_description', 'topic_label', 'tags'])}
            onGenerateField={(f) => generateFields([f])}
            busyField={busyField}
            generateDisabledReason={aiReady}
          />
          <CtaPanel form={form} set={set} services={services} />
        </div>
      </div>
      {toastNode}
    </div>
  );
}
