import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PLANS_KEY, UserPlan } from '../common/decorators/require-plans.decorator';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Plan-based RBAC guard. Works with @RequirePlans() decorator.
 * Must be applied AFTER ClerkAuthGuard (user must be authenticated first).
 *
 * Plan hierarchy: FREE < PRO < ENTERPRISE
 */
@Injectable()
export class PlansGuard implements CanActivate {
  private static readonly PLAN_RANK: Record<UserPlan, number> = {
    FREE: 0,
    PRO: 1,
    ENTERPRISE: 2,
  };

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.getAllAndOverride<UserPlan[]>(
      PLANS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No plan restriction on this route
    if (!requiredPlans || requiredPlans.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const user = request.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const userRank = PlansGuard.PLAN_RANK[user.plan] ?? 0;
    const hasAccess = requiredPlans.some(
      (plan) => userRank >= PlansGuard.PLAN_RANK[plan],
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `This feature requires one of: ${requiredPlans.join(', ')}`,
      );
    }

    return true;
  }
}
