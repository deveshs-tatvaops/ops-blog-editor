import path from 'node:path';

/**
 * Serverless hosts give each function instance its own read-only filesystem
 * (except /tmp), and route consecutive requests to different instances. A local
 * SQLite file is therefore not just non-durable there — it is not even shared
 * between two requests from the same user.
 *
 * So: one storage backend, libSQL, for everything. Point it at a hosted
 * database (Turso, or any libSQL server) and every instance sees the same data;
 * leave it unset and it falls back to a local file for development.
 */
export const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);

const remoteUrl =
  process.env.TURSO_DATABASE_URL ||
  process.env.LIBSQL_URL ||
  (process.env.DATABASE_URL?.startsWith('libsql:') || process.env.DATABASE_URL?.startsWith('http')
    ? process.env.DATABASE_URL
    : undefined);

export const DATABASE_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN;

/** Local file used when no hosted database is configured. */
const localFile = process.env.BLOG_DB_PATH
  ? path.resolve(process.env.BLOG_DB_PATH)
  : path.join(IS_SERVERLESS ? '/tmp/ops-blog' : process.cwd(), 'data', 'blog.db');

export const DATABASE_URL = remoteUrl ?? `file:${localFile}`;

export const DATABASE_IS_REMOTE = Boolean(remoteUrl);

/** Human-readable target for the health endpoint, with any credentials stripped. */
export function describeDatabase(): string {
  if (!DATABASE_IS_REMOTE) return DATABASE_URL;
  try {
    const u = new URL(DATABASE_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'remote libsql database';
  }
}

/**
 * True when the deployment is storing data somewhere that will not survive —
 * a local file on a serverless host, where each instance has its own copy.
 */
export const STORAGE_IS_EPHEMERAL = IS_SERVERLESS && !DATABASE_IS_REMOTE;
