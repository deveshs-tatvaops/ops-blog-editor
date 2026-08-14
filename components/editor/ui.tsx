'use client';

import { useEffect, useRef, useState } from 'react';

export function Counter({ value, max }: { value: number; max: number }) {
  const over = value > max;
  const near = !over && value > max * 0.9;
  return (
    <span
      className={`text-xs tabular-nums ${over ? 'font-semibold text-bad' : near ? 'text-warn' : 'text-ink-faint'}`}
    >
      {value}/{max}
    </span>
  );
}

export function Field({
  label,
  hint,
  counter,
  action,
  children,
}: {
  label: string;
  hint?: string;
  counter?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label className="font-display text-sm font-semibold text-ink">{label}</label>
        <div className="flex items-center gap-2">
          {action}
          {counter}
        </div>
      </div>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="panel-title">{title}</h2>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ScoreRing({ score, size = 92 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? '#1F9D63' : score >= 50 ? '#D98A00' : '#D64545';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0E3D8" strokeWidth={9} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * score) / 100}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .4s ease, stroke .3s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display"
        fontSize={size * 0.28}
        fontWeight={700}
        fill="#1F2130"
      >
        {score}
      </text>
    </svg>
  );
}

export function CheckRow({ passed, label, detail }: { passed: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          passed ? 'bg-ok' : 'bg-bad/80'
        }`}
      >
        {passed ? '✓' : '!'}
      </span>
      <span className="text-sm leading-snug">
        <span className={passed ? 'text-ink-muted' : 'text-ink'}>{label}</span>
        {detail ? <span className="block text-xs text-ink-faint">{detail}</span> : null}
      </span>
    </li>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-16 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export type ToastKind = 'success' | 'error' | 'info';

export function useToast() {
  const [toast, setToast] = useState<{ kind: ToastKind; message: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (kind: ToastKind, message: string) => {
    setToast({ kind, message });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  };
  const node = toast ? (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-pop ${
        toast.kind === 'success' ? 'bg-ok' : toast.kind === 'error' ? 'bg-bad' : 'bg-indigo950'
      }`}
    >
      {toast.message}
    </div>
  ) : null;
  return { show, node };
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Small inline "Generate" button used across the sidebar panels. */
export function GenerateButton({
  onClick,
  loading,
  disabled,
  label = 'Generate',
  title,
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-600 transition hover:border-brand-400 disabled:opacity-40"
    >
      {loading ? <Spinner className="h-3 w-3" /> : <span aria-hidden>✦</span>}
      {label}
    </button>
  );
}
