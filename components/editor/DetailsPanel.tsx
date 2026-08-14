'use client';

import { useState } from 'react';
import { LIMITS, type Service } from '@/lib/types';
import { pixelWidth, type EditorForm } from './state';
import { Counter, Field, GenerateButton, Panel } from './ui';

export function DetailsPanel({
  form,
  set,
  services,
  onGenerateAll,
  onGenerateField,
  busyField,
  generateDisabledReason,
}: {
  form: EditorForm;
  set: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  services: Service[];
  onGenerateAll: () => void;
  onGenerateField: (field: 'meta_title' | 'meta_description' | 'topic_label' | 'tags') => void;
  busyField: string | null;
  generateDisabledReason: string | null;
}) {
  const [tagInput, setTagInput] = useState('');
  const [secondaryPick, setSecondaryPick] = useState('');

  const metaTitlePx = pixelWidth(form.meta_title);
  const secondary = form.secondary_services;
  const available = services.filter(
    (s) => s.id !== form.primary_service_id && !secondary.some((x) => x.service_id === s.id)
  );

  function addTag(raw: string) {
    const parts = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...form.tags];
    for (const p of parts) if (!next.includes(p) && next.length < LIMITS.tags) next.push(p);
    set('tags', next);
  }

  return (
    <Panel
      title="Post details"
      right={
        <GenerateButton
          label="Generate all fields"
          onClick={onGenerateAll}
          loading={busyField === 'all'}
          disabled={!!generateDisabledReason}
          title={generateDisabledReason ?? undefined}
        />
      }
    >
      <Field
        label="Meta title"
        counter={<Counter value={form.meta_title.length} max={LIMITS.metaTitle} />}
        action={
          <GenerateButton
            onClick={() => onGenerateField('meta_title')}
            loading={busyField === 'meta_title'}
            disabled={!!generateDisabledReason}
            title={generateDisabledReason ?? undefined}
          />
        }
        hint={`≈${metaTitlePx}px wide — Google truncates around 580px.`}
      >
        <input
          className="input"
          value={form.meta_title}
          maxLength={LIMITS.metaTitle}
          onChange={(e) => set('meta_title', e.target.value)}
        />
      </Field>

      <Field
        label="Meta description"
        counter={<Counter value={form.meta_description.length} max={LIMITS.metaDescription} />}
        action={
          <GenerateButton
            onClick={() => onGenerateField('meta_description')}
            loading={busyField === 'meta_description'}
            disabled={!!generateDisabledReason}
            title={generateDisabledReason ?? undefined}
          />
        }
      >
        <textarea
          className="textarea"
          rows={3}
          value={form.meta_description}
          maxLength={LIMITS.metaDescription}
          onChange={(e) => set('meta_description', e.target.value)}
        />
      </Field>

      <Field label="Author name">
        <input
          className="input"
          value={form.author_name}
          onChange={(e) => set('author_name', e.target.value)}
        />
      </Field>

      <Field
        label="Primary service *"
        hint="Sets the post's canonical URL: /services/<service>/blog/<slug>."
      >
        <select
          className="input"
          value={form.primary_service_id ?? ''}
          onChange={(e) => set('primary_service_id', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select a service…</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Also feature on"
        hint="Adds the post to those services' blog listings and widgets — no second URL is created."
      >
        <select
          className="input"
          value={secondaryPick}
          onChange={(e) => {
            const id = Number(e.target.value);
            if (id) set('secondary_services', [...secondary, { service_id: id, pinned: false }]);
            setSecondaryPick('');
          }}
        >
          <option value="">Add a service…</option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <ul className="mt-2 space-y-1.5">
          {secondary.map((sec) => {
            const svc = services.find((s) => s.id === sec.service_id);
            if (!svc) return null;
            return (
              <li
                key={sec.service_id}
                className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
              >
                <span className="truncate text-sm">{svc.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      className="accent-[#F26522]"
                      checked={sec.pinned}
                      onChange={(e) =>
                        set(
                          'secondary_services',
                          secondary.map((x) =>
                            x.service_id === sec.service_id ? { ...x, pinned: e.target.checked } : x
                          )
                        )
                      }
                    />
                    Pin to top
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${svc.name}`}
                    className="text-ink-faint hover:text-bad"
                    onClick={() =>
                      set('secondary_services', secondary.filter((x) => x.service_id !== sec.service_id))
                    }
                  >
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </Field>

      <Field
        label="Topic label"
        action={
          <GenerateButton
            onClick={() => onGenerateField('topic_label')}
            loading={busyField === 'topic_label'}
            disabled={!!generateDisabledReason}
          />
        }
      >
        <input
          className="input"
          value={form.topic_label}
          placeholder="e.g. Construction Tech"
          onChange={(e) => set('topic_label', e.target.value)}
        />
      </Field>

      <Field
        label="Tags"
        counter={<Counter value={form.tags.length} max={LIMITS.tags} />}
        action={
          <GenerateButton
            onClick={() => onGenerateField('tags')}
            loading={busyField === 'tags'}
            disabled={!!generateDisabledReason}
          />
        }
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          {form.tags.map((t) => (
            <span key={t} className="chip">
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                className="text-ink-faint hover:text-bad"
                onClick={() => set('tags', form.tags.filter((x) => x !== t))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
        <input
          className="input"
          value={tagInput}
          disabled={form.tags.length >= LIMITS.tags}
          placeholder="Comma or Enter to add"
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(tagInput);
              setTagInput('');
            }
          }}
          onBlur={() => {
            if (tagInput.trim()) {
              addTag(tagInput);
              setTagInput('');
            }
          }}
        />
      </Field>

      <Field label="Word count target" hint="Raise this for pillar content; the gate and SEO check follow it.">
        <input
          type="number"
          min={100}
          step={50}
          className="input"
          value={form.word_count_target}
          onChange={(e) => set('word_count_target', Number(e.target.value) || LIMITS.defaultWordTarget)}
        />
      </Field>
    </Panel>
  );
}
