/**
 * Minimal TypeScript loader so `node --test` can import the lib/ modules
 * directly. Resolves extensionless relative imports the way the bundler does,
 * then strips types with sucrase.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { transform } from 'sucrase';

const CANDIDATES = ['.ts', '.tsx', '/index.ts'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parentPath = fileURLToPath(context.parentURL);
    for (const ext of CANDIDATES) {
      const candidate = path.resolve(path.dirname(parentPath), specifier + ext);
      try {
        readFileSync(candidate);
        return { url: pathToFileURL(candidate).href, shortCircuit: true, format: 'module' };
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
