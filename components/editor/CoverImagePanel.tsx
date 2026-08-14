'use client';

import { useRef, useState } from 'react';
import type { EditorForm } from './state';
import { Field, GenerateButton, Panel, Spinner } from './ui';

export function CoverImagePanel({
  form,
  set,
  onGenerateImage,
  generating,
  generateDisabledReason,
}: {
  form: EditorForm;
  set: <K extends keyof EditorForm>(key: K, value: EditorForm[K]) => void;
  onGenerateImage: () => void;
  generating: boolean;
  generateDisabledReason: string | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('That file is over 5MB.');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('enforceAspect', '16:9');
      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      set('cover_image_url', data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const resolvedAlt =
    form.cover_image_alt.trim() || form.cover_photo_description.trim() || form.title.trim();

  return (
    <Panel
      title="Cover image"
      right={
        <GenerateButton
          label="Generate image from content"
          onClick={onGenerateImage}
          loading={generating}
          disabled={!!generateDisabledReason}
          title={generateDisabledReason ?? undefined}
        />
      }
    >
      {form.cover_image_url ? (
        <div className="relative overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={form.cover_image_url}
            alt={resolvedAlt || 'Cover preview'}
            className="aspect-video w-full object-cover"
          />
          <button
            type="button"
            onClick={() => set('cover_image_url', '')}
            className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink shadow"
          >
            Remove
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) upload(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
            dragging ? 'border-brand-400 bg-brand-50' : 'border-line bg-cream-50 hover:border-brand-300'
          }`}
        >
          {uploading ? (
            <Spinner className="h-6 w-6 text-brand-500" />
          ) : (
            <>
              <span className="text-2xl" aria-hidden>
                🖼
              </span>
              <p className="font-display text-sm font-semibold">Drop a 16:9 image, or click to browse</p>
              <p className="text-xs text-ink-faint">PNG, JPG, WebP or GIF · up to 5MB</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      {error ? <p className="text-xs text-bad">{error}</p> : null}

      <Field label="Image URL">
        <input
          className="input"
          value={form.cover_image_url}
          onChange={(e) => set('cover_image_url', e.target.value)}
          placeholder="https://… or /uploads/…"
        />
      </Field>

      <Field label="Photo description" hint="Shown as the caption under the hero image.">
        <input
          className="input"
          value={form.cover_photo_description}
          onChange={(e) => set('cover_photo_description', e.target.value)}
        />
      </Field>

      <Field label="Photo credit">
        <input
          className="input"
          value={form.cover_photo_credit}
          onChange={(e) => set('cover_photo_credit', e.target.value)}
          placeholder="e.g. Photo: TatvaOps partner studio"
        />
      </Field>

      <Field
        label="Cover alt text *"
        hint={
          form.cover_image_alt.trim()
            ? undefined
            : resolvedAlt
              ? `Empty — will fall back to “${resolvedAlt}” on save.`
              : 'Required before publishing.'
        }
      >
        <input
          className="input"
          value={form.cover_image_alt}
          onChange={(e) => set('cover_image_alt', e.target.value)}
          placeholder="Describe the image"
        />
      </Field>
    </Panel>
  );
}
