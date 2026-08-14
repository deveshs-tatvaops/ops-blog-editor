/** Registers the TypeScript loader for scripts that import from lib/. */
import { register } from 'node:module';
register('./ts-loader.mjs', import.meta.url);
