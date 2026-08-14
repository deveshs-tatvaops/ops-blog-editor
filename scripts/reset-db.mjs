/** Deletes the SQLite database so the next run re-migrates and re-seeds services. */
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.BLOG_DB_PATH || path.join(process.cwd(), 'data', 'blog.db');
for (const suffix of ['', '-wal', '-shm', '-journal']) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`removed ${file}`);
  }
}
console.log('Database reset. It will be recreated and re-seeded on next start.');
