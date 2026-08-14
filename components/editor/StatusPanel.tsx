'use client';

import type { GateResult } from '@/lib/publish-gate';
import type { PostStatus } from '@/lib/types';
import { Panel, Spinner } from './ui';

const STATUS_COPY: { value: PostStatus; label: string; helper: string }[] = [
  { value: 'draft', label: 'Draft', helper: 'Only visible in the editor.' },
  { value: 'published', label: 'Published', helper: 'Live, listed and in the sitemap.' },
  { value: 'internal', label: 'Internal', helper: 'Live URL only, not listed anywhere.' },
];

export function StatusPanel({
  status,
  onStatusChange,
  scheduledFor,
  onScheduledChange,
  gate,
  saving,
  onSaveDraft,
  onPublish,
  lastSaved,
  publicUrl,
}: {
  status: PostStatus;
  onStatusChange: (s: PostStatus) => void;
  scheduledFor: string;
  onScheduledChange: (v: string) => void;
  gate: GateResult;
  saving: 'draft' | 'publish' | null;
  onSaveDraft: () => void;
  onPublish: () => void;
  lastSaved: string | null;
  publicUrl: string | null;
}) {
  const scheduled = !!scheduledFor;
  return (
    <Panel title="Status">
      <div className="grid gap-2">
        {STATUS_COPY.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onStatusChange(s.value)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              status === s.value
                ? 'border-brand-400 bg-brand-50 shadow-[0_0_0_3px_rgba(242,101,34,.08)]'
                : 'border-line bg-white hover:border-brand-200'
            }`}
          >
            <span
              aria-hidden
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-[5px] ${
                status === s.value ? 'border-brand-500' : 'border-line'
              }`}
            />
            <span>
              <span className="block font-display text-sm font-semibold">{s.label}</span>
              <span className="block text-xs text-ink-faint">{s.helper}</span>
            </span>
          </button>
        ))}
      </div>

      <div>
        <label className="field-label">Schedule publish</label>
        <input
          type="datetime-local"
          className="input"
          value={scheduledFor}
          onChange={(e) => onScheduledChange(e.target.value)}
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          {scheduled
            ? 'The scheduler re-checks the publish gate at that time and keeps the post as a draft if anything regressed.'
            : 'Empty means the post goes live as soon as you hit Publish.'}
        </p>
      </div>

      {!gate.canPublish ? (
        <div className="rounded-xl border border-warn/30 bg-warn/5 p-3">
          <p className="font-display text-xs font-semibold uppercase tracking-wide text-warn">
            {gate.blocking.length} thing{gate.blocking.length === 1 ? '' : 's'} blocking publish
          </p>
          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
            {gate.blocking.map((b) => (
              <li key={b.id} className="flex gap-2">
                <span aria-hidden className="text-warn">
                  •
                </span>
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl border border-ok/30 bg-ok/5 p-3 text-xs font-medium text-ok">
          All publish checks passed.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" className="btn-ghost w-full" onClick={onSaveDraft} disabled={!!saving}>
          {saving === 'draft' ? <Spinner /> : null} Save draft
        </button>
        <button
          type="button"
          className="btn-primary w-full"
          onClick={onPublish}
          disabled={!gate.canPublish || !!saving}
          title={gate.canPublish ? undefined : gate.blocking.map((b) => b.label).join(' · ')}
        >
          {saving === 'publish' ? <Spinner /> : null}
          {scheduled ? 'Schedule publish' : 'Publish'}
        </button>
      </div>

      {lastSaved ? <p className="text-center text-xs text-ink-faint">Saved {lastSaved}</p> : null}
      {publicUrl ? (
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs font-medium text-brand-600 hover:underline"
        >
          View live post ↗
        </a>
      ) : null}
    </Panel>
  );
}
