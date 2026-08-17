import { createClient, type Client, type InArgs, type Row } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { DATABASE_AUTH_TOKEN, DATABASE_IS_REMOTE, DATABASE_URL } from './runtime';
import { SCHEMA_STATEMENTS } from './schema';

/** Services shipped with the site. Slugs match the live /services/<slug> paths. */
export const SERVICE_SEED: { slug: string; name: string }[] = [
  { slug: 'interior', name: 'Residential Interiors' },
  { slug: 'home-renovation', name: 'Home Renovation' },
  { slug: 'residential-construction', name: 'Residential Construction' },
  { slug: 'solar-energy-solutions', name: 'Solar and Energy Solutions' },
  { slug: 'property-sales-and-rentals-operations', name: 'Property Sales and Rentals Operations' },
  { slug: 'home-maintenance-appliance-care', name: 'Home and Appliance Maintenance Care' },
  { slug: 'commercial-interiors', name: 'Commercial Interiors' },
  { slug: 'landscaping-outdoor-development', name: 'Landscaping & Outdoor Development' },
  { slug: 'managed-household-staffing', name: 'Managed Household Staffing' },
  { slug: 'integrated-facility-management-security', name: 'Integrated Facility Management & Security' },
  { slug: 'property-development', name: 'Property Development' },
  { slug: 'commercial-construction', name: 'Commercial Construction' },
  { slug: 'farm-infrastructure-self-sustainability', name: 'Farm Infrastructure & Self-Sustainability' },
  { slug: 'cctv-automation', name: 'CCTV and Home Automation' },
  { slug: 'event-management', name: 'Event Management' },
];

// Cached on globalThis so a warm serverless instance reuses one client and only
// migrates once, even across module reloads in development.
const globalForDb = globalThis as unknown as { __opsBlogDb?: Promise<Client> };

async function connect(): Promise<Client> {
  if (!DATABASE_IS_REMOTE) {
    const file = DATABASE_URL.replace(/^file:/, '');
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  const client = createClient({
    url: DATABASE_URL,
    ...(DATABASE_AUTH_TOKEN ? { authToken: DATABASE_AUTH_TOKEN } : {}),
  });

  // Every statement is idempotent, so concurrent instances can migrate safely.
  for (const statement of SCHEMA_STATEMENTS) {
    await client.execute(statement);
  }

  await client.batch(
    SERVICE_SEED.map((s, i) => ({
      sql: `INSERT INTO services (slug, name, cta_default_url, sort_order)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order`,
      args: [s.slug, s.name, `/services/${s.slug}#enquire`, i],
    })),
    'write'
  );

  return client;
}

export function getDb(): Promise<Client> {
  if (!globalForDb.__opsBlogDb) {
    globalForDb.__opsBlogDb = connect().catch((err) => {
      // Don't cache a failed connection — the next request should retry.
      globalForDb.__opsBlogDb = undefined;
      throw err;
    });
  }
  return globalForDb.__opsBlogDb;
}

export async function all(sql: string, args: InArgs = []): Promise<Row[]> {
  const db = await getDb();
  const result = await db.execute({ sql, args });
  return result.rows;
}

export async function one(sql: string, args: InArgs = []): Promise<Row | null> {
  const rows = await all(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: InArgs = []): Promise<void> {
  const db = await getDb();
  await db.execute({ sql, args });
}

/** Runs a set of statements atomically. */
export async function batch(statements: { sql: string; args?: InArgs }[]): Promise<void> {
  if (!statements.length) return;
  const db = await getDb();
  await db.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    'write'
  );
}
