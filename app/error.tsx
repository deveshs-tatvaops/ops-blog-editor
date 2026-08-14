'use client';

/**
 * Production server errors reach the browser as a bare digest, which is useless
 * when a deployment fails on something environmental. This at least names the
 * usual suspect and where to look.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="eyebrow">Something broke</p>
      <h1 className="section-heading mt-3">This page hit a server error</h1>
      <p className="mt-4 text-ink-muted">
        If this is a fresh deployment, the most common cause is storage: the app writes a SQLite file
        and uploaded images to disk, and serverless hosts only allow writes to <code>/tmp</code>. Check{' '}
        <code>/api/health</code> for what the server can actually reach.
      </p>
      {error.digest ? (
        <p className="mt-4 text-xs text-ink-faint">
          Digest <code>{error.digest}</code> — search your host&apos;s function logs for it.
        </p>
      ) : null}
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/api/health" className="btn-ghost">
          Open /api/health
        </a>
      </div>
    </main>
  );
}
