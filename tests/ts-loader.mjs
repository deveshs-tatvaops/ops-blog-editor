/**
 * Minimal TypeScript loader so `node --test` and the brand-asset script can
 * import the lib/ modules directly. Resolves extensionless relative imports the
 * way the bundler does, then strips types with sucrase.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transform } from 'sucrase';

const CANDIDATES = ['.ts', '.tsx', '/index.ts'];

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('.');
  const aliased = specifier.startsWith('@/');
  if ((relative || aliased) && !path.extname(specifier)) {
    const base = aliased
      ? path.join(process.cwd(), specifier.slice(2))
      : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const ext of CANDIDATES) {
      try {
        readFileSync(base + ext);
        return { url: pathToFileURL(base + ext).href, shortCircuit: true, format: 'module' };
      } catch {
        // try the next extension
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const { code } = transform(source, {
      transforms: ['typescript', 'jsx'],
      jsxRuntime: 'automatic',
      filePath: fileURLToPath(url),
    });
    return { format: 'module', source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}
