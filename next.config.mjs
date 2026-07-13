import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the file-tracing root to this app so a parent lockfile can't be
  // mistaken for the workspace root.
  outputFileTracingRoot: projectRoot,
  // better-sqlite3 is a native addon; keep it external to the server bundle
  // (required for the Turbopack production build in Next 16).
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
