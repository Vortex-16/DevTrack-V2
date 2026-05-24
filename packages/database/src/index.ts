// This file is the sole entry point for the database package.
// All other packages/apps must import from '@devtrack/database', never from @prisma/client directly.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export Prisma types and classes for consumers
export * from '@prisma/client';
// PrismaClient as VALUE export (not type-only) — required for class extension in PrismaService
export { PrismaClient } from '@prisma/client';
