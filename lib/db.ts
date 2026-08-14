import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from './runtime';
import { SCHEMA_SQL } from './schema';

export type DB = Database.Database;

let instance: DB | null = null;

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

function migrate(db: DB) {
  db.exec(SCHEMA_SQL);
}

function seed(db: DB) {
  const insert = db.prepare(
    `INSERT INTO services (slug, name, cta_default_url, sort_order)
     VALUES (@slug, @name, @cta_default_url, @sort_order)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order`
  );
  const tx = db.transaction(() => {
    SERVICE_SEED.forEach((s, i) => {
      insert.run({
        slug: s.slug,
        name: s.name,
        cta_default_url: `/services/${s.slug}#enquire`,
        sort_order: i,
      });
    });
  });
  tx();
}

export function getDb(): DB {
  if (instance) return instance;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seed(db);
  instance = db;
  return db;
}
