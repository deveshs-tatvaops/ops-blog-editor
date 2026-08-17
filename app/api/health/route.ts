import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listMedia } from '@/lib/media';
import { listServices } from '@/lib/posts';
import {
  DATABASE_IS_REMOTE,
  IS_SERVERLESS,
  STORAGE_IS_EPHEMERAL,
  describeDatabase,
} from '@/lib/runtime';

export const dynamic = 'force-dynamic';

/** Deployment diagnostics: what the server can actually reach and write. */
export async function GET() {
  const report: Record<string, unknown> = {
    ok: true,
    serverless: IS_SERVERLESS,
    database: describeDatabase(),
    databaseIsShared: DATABASE_IS_REMOTE,
    storageIsEphemeral: STORAGE_IS_EPHEMERAL,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '(default) https://ops.withtatva.ai',
  };

  try {
    await getDb();
    report.services = (await listServices()).length;
    report.mediaItems = (await listMedia()).length;
  } catch (err) {
    report.ok = false;
    report.databaseError = err instanceof Error ? err.message : String(err);
  }

  try {
    const sharp = (await import('sharp')).default;
    await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).webp().toBuffer();
    report.imagePipeline = true;
  } catch (err) {
    report.ok = false;
    report.imagePipeline = false;
    report.imagePipelineError = err instanceof Error ? err.message : String(err);
  }

  if (STORAGE_IS_EPHEMERAL) {
    report.warning =
      'No shared database configured. Each serverless instance has its own throwaway SQLite file, ' +
      'so posts saved by one request are invisible to the next. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.';
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
