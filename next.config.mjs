/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native modules must not be bundled by webpack — they are required at runtime.
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  // Make sure the prebuilt .node binary travels with the serverless function.
  outputFileTracingIncludes: {
    '/**': ['./node_modules/better-sqlite3/build/Release/*.node'],
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
export default nextConfig;
