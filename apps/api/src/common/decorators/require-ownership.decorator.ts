import { SetMetadata } from '@nestjs/common';

export const REQUIRE_OWNERSHIP_KEY = 'requireOwnership';

/**
 * @param resource The Prisma model name (camelCase) e.g. 'repository' or 'project'
 * @param idParam The request param name that contains the resource id (default: 'id')
 */
export const RequireOwnership = (resource: string, idParam = 'id') =>
  SetMetadata(REQUIRE_OWNERSHIP_KEY, { resource, idParam });
