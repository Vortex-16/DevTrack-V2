import type { NextConfig } from 'next';
import { validateWebEnv } from '@devtrack/config';

// Validate all required env vars at build time.
// Throws with a clear list of missing/invalid keys before Next.js compiles anything.
validateWebEnv(process.env as Record<string, unknown>);

const nextConfig: NextConfig = {
  // Expose only specific server-side values via env to prevent accidental leaks
  // (NEXT_PUBLIC_ vars are already bundled automatically by Next.js)
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
