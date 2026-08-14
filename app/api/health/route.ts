import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { listServices } from '@/lib/posts';
import { DB_PATH, IS_SERVERLESS, STORAGE_IS_EPHEMERAL, UPLOAD_DIR } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

/** Deployment diagnostics: what the server can actually open and write. */
export async function GET() {
  const report: Record<string, unknown> = {
    ok: true,
    serverless: IS_SERVERLESS,
    storageIsEphemeral: STORAGE_IS_EPHEMERAL,
    dbPath: DB_PATH,
    uploadDir: UPLOAD_DIR,
    aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || '(default) https://ops.withtatva.ai',
  };

  try {
    getDb();
    report.database = { ok: true, services: listServices().length };
  } catch (err) {
    report.ok = false;
    report.database = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const probe = path.join(UPLOAD_DIR, '.health');
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe);
    report.uploadsWritable = true;
  } catch (err) {
    report.ok = false;
    report.uploadsWritable = false;
    report.uploadsError = err instanceof Error ? err.message : String(err);
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

  return NextResponse.json(report, { status: report.ok ? 200 : 500 });
}
