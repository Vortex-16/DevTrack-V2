import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { GithubService } from './github.service';
import { GithubOAuthService } from './github-oauth.service';

@Controller({ path: 'github', version: '1' })
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly oauthService: GithubOAuthService,
  ) {}

  /**
   * GET /api/v1/github/connect
   * Returns the GitHub OAuth authorization URL for the mobile app.
   * Mobile opens this URL in expo-web-browser (AuthSession).
   */
  @Get('connect')
  @UseGuards(ClerkAuthGuard)
  connect(@CurrentUser() user: AuthenticatedUser) {
    const url = this.oauthService.generateAuthUrl(user.id);
    return { url };
  }

  /**
   * GET /api/v1/github/callback
   * GitHub redirects here after user authorizes.
   * This route is NOT auth-guarded — GitHub calls it with state (which encodes userId).
   * Redirects to mobile deep link: devtrack://oauth/github?success=true
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    // User denied GitHub access
    if (error) {
      this.logger.warn({ msg: 'GitHub OAuth denied', error });
      return res.redirect('devtrack://oauth/github?success=false&error=access_denied');
    }

    try {
      const deepLink = await this.oauthService.handleCallback(code, state);
      return res.redirect(deepLink);
    } catch (err) {
      const msg = err instanceof Error ? encodeURIComponent(err.message) : 'unknown_error';
      this.logger.error({ msg: 'GitHub OAuth callback failed', error: msg });
      return res.redirect(`devtrack://oauth/github?success=false&error=${msg}`);
    }
  }

  /**
   * GET /api/v1/github/status
   * Returns whether GitHub is connected for the current user.
   */
  @Get('status')
  @UseGuards(ClerkAuthGuard)
  async status(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.oauthService.getConnectedAccount(user.id);
    return {
      connected: !!account,
      login: account?.login ?? null,
      scopes: account?.scopes ?? [],
      connectedAt: account?.createdAt ?? null,
    };
  }

  /**
   * DELETE /api/v1/github/disconnect
   * Removes the GitHub account and all synced data for the user.
   */
  @Delete('disconnect')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    await this.oauthService.disconnectAccount(user.id);
  }

  /**
   * POST /api/v1/github/sync
   * Manually trigger a sync for the current user. Returns 202 immediately.
   */
  @Post('sync')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@CurrentUser() user: AuthenticatedUser) {
    const traceId = crypto.randomUUID();
    void this.githubService.runScheduledSync(traceId);
    return { message: 'Sync started', traceId };
  }
}
