import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * Protects routes with Clerk JWT authentication.
 * Apply to individual routes or entire controllers.
 *
 * Usage:
 *   @UseGuards(ClerkAuthGuard)
 *   @Get('me')
 *   getMe(@CurrentUser() user: AuthenticatedUser) { ... }
 */
@Injectable()
export class ClerkAuthGuard extends AuthGuard('clerk-jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }
}
