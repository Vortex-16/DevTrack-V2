import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { REQUIRE_OWNERSHIP_KEY } from '../decorators/require-ownership.decorator';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<{ resource: string; idParam: string }>(REQUIRE_OWNERSHIP_KEY, context.getHandler());
    if (!meta) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as any;
    if (!user) return false;

    const id = request.params?.[meta.idParam];
    if (!id) return false;

    try {
      // Attempt to load the record by model name dynamically.
      // For simple models with `userId` on the record, compare directly.
      // Special-case `commit` which is owned via its repository.
      const model = (this.prisma as any)[meta.resource];
      if (!model || !model.findUnique) return false;

      if (meta.resource === 'commit') {
        const commit = await model.findUnique({ where: { id }, include: { repository: true } });
        if (!commit) return false;
        if (commit.repository?.userId !== user.id) throw new ForbiddenException();
        return true;
      }

      // Prefer findFirst with userId to avoid accidental leakage via findUnique
      const owned = await model.findFirst({ where: { id, userId: user.id } });
      if (owned) return true;

      // Fallback: load minimal record to check repository ownership
      const record = await model.findUnique({ where: { id }, select: { repositoryId: true } as any });
      if (!record) return false;
      if (record.repositoryId) {
        const repo = await this.prisma.repository.findFirst({ where: { id: record.repositoryId, userId: user.id } });
        if (repo) return true;
      }

      throw new ForbiddenException();
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      return false;
    }
  }
}
