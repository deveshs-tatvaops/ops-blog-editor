'use client';

import { useState } from 'react';
import type { SeoResult } from '@/lib/seo';
import { LIMITS, type Service } from '@/lib/types';
import type { EditorForm } from './state';
import { CheckRow, GenerateButton, Panel, ScoreRing } from './ui';

export function SeoPanel({
  form,
  set,
  seo,
  service,
  onCreateSchema,
  schemaBusy,
}: {
  form: EditorForm;
  set: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  seo: SeoResult;
  service: Service | null;
  onCreateSchema: () => void;
  schemaBusy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kwInput, setKwInput] = useState('');

  const host = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ops.withtatva.ai').replace(/^https?:\/\//, '');
  const breadcrumb = service
    ? `${host} › services › ${service.slug} › blog › ${form.slug || 'post-slug'}`
    : `${host} › services › … › blog`;

  return (
    <Panel title="SEO">
      {/* Google SERP preview */}
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Google preview
        </p>
        <p className="truncate text-xs text-[#4d5156]">{breadcrumb}</p>
        <p className="mt-0.5 line-clamp-2 font-display text-[18px] leading-snug text-[#1a0dab]">
          {form.meta_title || form.title || 'Your post title appears here'}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[#4d5156]">
          {form.meta_description ||
            form.excerpt ||
            'Your meta description appears here — write it as a reason to click.'}
        </p>
        {form.canonical_url ? (
          <p className="mt-2 truncate text-[11px] text-ink-faint">Canonical: {form.canonical_url}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-line bg-cream-50 p-4">
        <ScoreRing score={seo.score} />
        <div>
          <p className="font-display text-sm font-bold">
            {seo.passed} of {seo.total} checks passed
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {seo.score >= 80 ? 'Strong' : seo.score >= 50 ? 'Needs work' : 'Weak'} — recalculated as you type.
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
          >
            {open ? 'Hide checks' : 'Show all 15 checks'}
          </button>
        </div>
      </div>

      {open ? (
        <ul className="divide-y divide-line rounded-xl border border-line px-3 py-1">
          {seo.checks.map((c) => (
            <CheckRow key={c.id} passed={c.passed} label={c.label} detail={c.detail} />
          ))}
        </ul>
      ) : null}

      <div>
        <label className="field-label">Focus keyword</label>
        <input
          className="input"
          value={form.focus_keyword}
          onChange={(e) => set('focus_keyword', e.target.value)}
          placeholder="e.g. interior designers in Bangalore"
        />
      </div>

      <div>
        <label className="field-label">
          Secondary keywords{' '}
          <span className="font-normal text-ink-faint">({form.secondary_keywords.length}/{LIMITS.secondaryKeywords})</span>
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {form.secondary_keywords.map((k) => (
            <span key={k} className="chip">
              {k}
              <button
                type="button"
                onClick={() =>
                  set('secondary_keywords', form.secondary_keywords.filter((x) => x !== k))
                }
                aria-label={`Remove ${k}`}
                className="text-ink-faint hover:text-bad"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <input
          className="input"
          value={kwInput}
          disabled={form.secondary_keywords.length >= LIMITS.secondaryKeywords}
          placeholder="Type and press Enter"
          onChange={(e) => setKwInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              const v = kwInput.trim();
              if (v && !form.secondary_keywords.includes(v)) {
                set('secondary_keywords', [...form.secondary_keywords, v].slice(0, LIMITS.secondaryKeywords));
              }
              setKwInput('');
            }
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
        <div>
          <p className="font-display text-sm font-semibold">Schema markup</p>
          <p className="text-xs text-ink-faint">
            {form.schema_jsonld
              ? `${JSON.parse(form.schema_jsonld || '[]').length} blocks cached`
              : 'Article + Breadcrumb, plus FAQ when the draft has one.'}
          </p>
        </div>
        <GenerateButton label="Create" onClick={onCreateSchema} loading={schemaBusy} />
      </div>
    </Panel>
  );
}
