'use client';

import { marked } from 'marked';
import { useMemo, useRef, useState } from 'react';
import { Counter, GenerateButton, Modal, Spinner } from './ui';
import { countWords, readingTime } from '@/lib/markdown';
import { LIMITS } from '@/lib/types';

interface LinkSuggestion {
  anchor: string;
  url: string;
  reason: string;
}

interface QualityReport {
  summary: string;
  issues: { type: string; severity: 'high' | 'medium' | 'low'; detail: string; suggestion: string }[];
  passiveVoice: string[];
}

interface PlagiarismReport {
  verdict: string;
  risk: 'low' | 'medium' | 'high';
  matches: { source: string; excerpt: string; note: string }[];
}

export function ContentEditor({
  value,
  onChange,
  onGenerateDraft,
  onRefine,
  aiBusy,
  disabledReason,
}: {
  value: string;
  onChange: (next: string) => void;
  onGenerateDraft: () => void;
  onRefine: () => void;
  aiBusy: string | null;
  disabledReason: string | null;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [panel, setPanel] = useState<'none' | 'quality' | 'plagiarism' | 'links'>('none');
  const [busy, setBusy] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [plagiarism, setPlagiarism] = useState<PlagiarismReport | null>(null);
  const [suggestions, setSuggestions] = useState<LinkSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  const words = useMemo(() => countWords(value), [value]);
  const minutes = readingTime(words);
  const html = useMemo(
    () => (mode === 'preview' ? (marked.parse(value || '', { async: false }) as string) : ''),
    [mode, value]
  );

  function insertAtCursor(snippet: string) {
    const el = ref.current;
    if (!el) {
      onChange(value + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  }

  async function runTool(kind: 'quality' | 'plagiarism' | 'links') {
    setBusy(kind);
    setError(null);
    try {
      const endpoint =
        kind === 'quality' ? 'quality-check' : kind === 'plagiarism' ? 'plagiarism' : 'internal-links';
      const res = await fetch(`/api/ai/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content_markdown: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (kind === 'quality') setQuality(data.report);
      if (kind === 'plagiarism') setPlagiarism(data.report);
      if (kind === 'links') setSuggestions(data.suggestions);
      setPanel(kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setPanel(kind);
    } finally {
      setBusy(null);
    }
  }

  const toolBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-40';

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-cream-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <GenerateButton
            label="Generate draft with AI"
            onClick={onGenerateDraft}
            loading={aiBusy === 'draft'}
            disabled={!!disabledReason || !!aiBusy}
            title={disabledReason ?? undefined}
          />
          <GenerateButton
            label="Refine with AI"
            onClick={onRefine}
            loading={aiBusy === 'refine'}
            disabled={!!aiBusy || value.trim().length < 40}
            title={value.trim().length < 40 ? 'Write a little more first' : undefined}
          />
        </div>
        <div className="inline-flex rounded-full border border-line bg-white p-0.5">
          {(['write', 'preview'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                mode === m ? 'bg-brand-gradient text-white' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <button type="button" className={toolBtn} onClick={() => setLinkOpen(true)}>
          🔗 Insert link
        </button>
        <button type="button" className={toolBtn} onClick={() => setImageOpen(true)}>
          🖼 Insert image
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button type="button" className={toolBtn} disabled={!!busy} onClick={() => runTool('quality')}>
          {busy === 'quality' ? <Spinner className="h-3 w-3" /> : '✦'} AI quality check
        </button>
        <button type="button" className={toolBtn} disabled={!!busy} onClick={() => runTool('plagiarism')}>
          {busy === 'plagiarism' ? <Spinner className="h-3 w-3" /> : '⚖'} Plagiarism check
        </button>
        <button type="button" className={toolBtn} disabled={!!busy} onClick={() => runTool('links')}>
          {busy === 'links' ? <Spinner className="h-3 w-3" /> : '⛓'} Auto internal links
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, LIMITS.content))}
          spellCheck
          placeholder={'# Start writing\n\nUse ## for section headings, and link to relevant service pages with descriptive anchor text.'}
          className="min-h-[520px] w-full resize-y border-0 px-5 py-4 font-mono text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
        />
      ) : (
        <div className="prose-ops min-h-[520px] px-6 py-5" dangerouslySetInnerHTML={{ __html: html }} />
      )}

      <div className="flex items-center justify-between border-t border-line bg-cream-50 px-4 py-2.5 text-xs text-ink-faint">
        <span>
          <strong className="font-semibold text-ink-muted">{words.toLocaleString()}</strong> words ·{' '}
          {minutes} min read
        </span>
        <Counter value={value.length} max={LIMITS.content} />
      </div>

      <InsertLinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        onInsert={(text, url) => {
          insertAtCursor(`[${text}](${url})`);
          setLinkOpen(false);
        }}
      />
      <InsertImageModal
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onInsert={(alt, url) => {
          insertAtCursor(`\n\n![${alt}](${url})\n\n`);
          setImageOpen(false);
        }}
      />

      <Modal
        open={panel !== 'none'}
        wide
        title={
          panel === 'quality'
            ? 'AI quality check'
            : panel === 'plagiarism'
              ? 'Plagiarism check'
              : 'Suggested internal links'
        }
        onClose={() => setPanel('none')}
      >
        {error ? <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad">{error}</p> : null}

        {!error && panel === 'quality' && quality ? (
          <div className="space-y-4 text-sm">
            <p className="text-ink-muted">{quality.summary}</p>
            <ul className="space-y-2">
              {quality.issues.map((issue, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`chip !py-0.5 ${
                        issue.severity === 'high'
                          ? '!border-bad/30 !bg-bad/10 !text-bad'
                          : issue.severity === 'medium'
                            ? '!border-warn/30 !bg-warn/10 !text-warn'
                            : ''
                      }`}
                    >
                      {issue.severity}
                    </span>
                    <strong className="font-display">{issue.type}</strong>
                  </div>
                  <p className="mt-1.5 text-ink-muted">{issue.detail}</p>
                  <p className="mt-1 text-ink">→ {issue.suggestion}</p>
                </li>
              ))}
            </ul>
            {quality.passiveVoice?.length ? (
              <div>
                <h4 className="panel-title mb-2">Passive voice flagged (not rewritten)</h4>
                <ul className="list-disc space-y-1 pl-5 text-ink-muted">
                  {quality.passiveVoice.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {!error && panel === 'plagiarism' && plagiarism ? (
          <div className="space-y-3 text-sm">
            <p className="chip">Risk: {plagiarism.risk}</p>
            <p className="text-ink-muted">{plagiarism.verdict}</p>
            {plagiarism.matches.map((m, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <strong className="font-display">{m.source}</strong>
                <p className="mt-1 italic text-ink-muted">“{m.excerpt}”</p>
                <p className="mt-1">{m.note}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!error && panel === 'links' && suggestions ? (
          <div className="space-y-2 text-sm">
            {suggestions.length === 0 ? (
              <p className="text-ink-muted">No new linking opportunities found.</p>
            ) : null}
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
                <div>
                  <p className="font-medium">
                    “{s.anchor}” → <span className="text-brand-600">{s.url}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">{s.reason}</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost !px-3 !py-1.5 !text-xs"
                  onClick={() => {
                    const idx = value.indexOf(s.anchor);
                    if (idx >= 0) {
                      onChange(
                        value.slice(0, idx) + `[${s.anchor}](${s.url})` + value.slice(idx + s.anchor.length)
                      );
                    } else {
                      insertAtCursor(`[${s.anchor}](${s.url})`);
                    }
                  }}
                >
                  Insert
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

function InsertLinkModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (text: string, url: string) => void;
}) {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const vague = /^(click here|here|read more|this)$/i.test(text.trim());
  return (
    <Modal open={open} title="Insert link" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="field-label">Anchor text</label>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} />
          {vague ? (
            <p className="mt-1.5 text-xs text-warn">
              Use descriptive anchor text that says where the link goes.
            </p>
          ) : null}
        </div>
        <div>
          <label className="field-label">URL</label>
          <input
            className="input"
            value={url}
            placeholder="/services/interior or https://…"
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!text.trim() || !url.trim()}
          onClick={() => {
            onInsert(text.trim(), url.trim());
            setText('');
            setUrl('');
          }}
        >
          Insert link
        </button>
      </div>
    </Modal>
  );
}

function InsertImageModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (alt: string, url: string) => void;
}) {
  const [alt, setAlt] = useState('');
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open={open} title="Insert image" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="field-label">Upload</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="input !py-2 file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-600"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          {uploading ? <p className="mt-1.5 text-xs text-ink-faint">Uploading and converting…</p> : null}
          {error ? <p className="mt-1.5 text-xs text-bad">{error}</p> : null}
        </div>
        <div>
          <label className="field-label">Image URL</label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Alt text (required)</label>
          <input
            className="input"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image for screen readers and search"
          />
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!alt.trim() || !url.trim()}
          onClick={() => {
            onInsert(alt.trim(), url.trim());
            setAlt('');
            setUrl('');
          }}
        >
          {alt.trim() ? 'Insert image' : 'Alt text required'}
        </button>
      </div>
    </Modal>
  );
}
