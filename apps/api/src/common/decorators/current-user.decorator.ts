import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts the authenticated user from the request object.
 * The ClerkGuard must run before this decorator is used.
 *
 * Usage:
 *   @Get('profile')
 *   @UseGuards(ClerkAuthGuard)
 *   getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    return request.user;
  },
);

/**
 * The shape of the authenticated user attached to every request
 * after ClerkAuthGuard validates the JWT.
 */
export interface AuthenticatedUser {
  /** Internal DevTrack DB user ID (cuid) */
  id: string;
  /** Clerk's user ID — canonical identity source */
  clerkId: string;
  /** User email from Clerk JWT */
  email: string;
  /** Subscription plan */
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  /** User role for RBAC */
  role: 'USER' | 'ADMIN' | 'MODERATOR';
}
