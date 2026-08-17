/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native modules must not be bundled by webpack — they are required at runtime.
  serverExternalPackages: ['@libsql/client', 'libsql', 'sharp'],
  // Make sure the prebuilt bindings travel with the serverless function. The
  // libsql binding is only needed for the local-file fallback; a hosted libsql
  // database is reached over HTTP.
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@libsql/linux-x64-gnu/*.node'],
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};
export default nextConfig;
