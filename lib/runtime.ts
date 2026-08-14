import path from 'node:path';

/**
 * Vercel (and any Lambda-style host) gives the function a read-only filesystem
 * with /tmp as the only writable directory, so the default storage locations
 * have to move there. /tmp is per-instance and wiped between cold starts —
 * fine for a preview deploy, not for real content. Point BLOG_DB_PATH at a
 * mounted volume, or move to Postgres/Turso, before this holds anything real.
 */
export const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

const writableRoot = IS_SERVERLESS ? '/tmp/ops-blog' : process.cwd();

export const DB_PATH = process.env.BLOG_DB_PATH || path.join(writableRoot, 'data', 'blog.db');

export const UPLOAD_DIR = process.env.BLOG_UPLOAD_DIR || path.join(writableRoot, 'data', 'uploads');

/** True when storage is ephemeral, so the UI can say so instead of quietly losing work. */
export const STORAGE_IS_EPHEMERAL =
  IS_SERVERLESS && !process.env.BLOG_DB_PATH && !process.env.BLOG_STORAGE_IS_PERSISTENT;
