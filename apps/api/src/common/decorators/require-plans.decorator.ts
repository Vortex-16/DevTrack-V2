import { SetMetadata } from '@nestjs/common';

export type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export const PLANS_KEY = 'requiredPlans';

/**
 * Marks a route as requiring a minimum subscription plan.
 * Works in conjunction with PlansGuard.
 *
 * Usage:
 *   @RequirePlans('PRO', 'ENTERPRISE')
 *   @UseGuards(ClerkAuthGuard, PlansGuard)
 *   getAiInsights() { ... }
 */
export const RequirePlans = (...plans: UserPlan[]) =>
  SetMetadata(PLANS_KEY, plans);
