import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (!roles || roles.length === 0) return true; // no role restriction

    const request = context.switchToHttp().getRequest();
    const user = request.user as any;
    if (!user) return false;

    // Support both explicit `role` and subscription `plan` as role checks
    const userRoles = [] as string[];
    if (user.role) userRoles.push(user.role);
    if (user.plan) userRoles.push(user.plan);

    return roles.some((r) => userRoles.includes(r));
  }
}
