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
  Body,
  Headers,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { GithubService } from './github.service';
import { GithubOAuthService } from './github-oauth.service';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { RedisService } from '../common/services/redis.service';

@Controller({ path: 'github', version: '1' })
export class GithubController {
  private readonly logger = new Logger(GithubController.name);

  constructor(
    private readonly githubService: GithubService,
    private readonly oauthService: GithubOAuthService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  /**
   * GET /api/v1/github/connect
   * Returns the GitHub OAuth authorization URL for the mobile app.
   * Mobile opens this URL in expo-web-browser (AuthSession).
   */
  @Get('connect')
  @UseGuards(ClerkAuthGuard)
  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 5, ttl: 60000 } })
  connect(
    @CurrentUser() user: AuthenticatedUser,
    @Query('redirect_uri') redirectUri?: string,
  ) {
    const url = this.oauthService.generateAuthUrl(user.id, redirectUri);
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
  @Throttle({ short: { limit: 3, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
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
  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 3, ttl: 60000 } })
  async disconnect(@CurrentUser() user: AuthenticatedUser) {
    await this.oauthService.disconnectAccount(user.id);
  }

  /**
   * POST /api/v1/github/webhook
   * GitHub webhook for repository events. Verifies HMAC-SHA256 and triggers a user sync.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-delivery') deliveryId: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    if (!event) {
      throw new BadRequestException('Missing GitHub event header');
    }

    this.verifyWebhookSignature(signature, req.rawBody);

    // Replay protection: require X-GitHub-Delivery header and ensure id is new
    if (!deliveryId) {
      throw new BadRequestException('Missing X-GitHub-Delivery header');
    }

    const dedupeKey = `gh:webhook:${deliveryId}`;
    if (await this.redis.exists(dedupeKey)) {
      this.logger.warn({ msg: 'Duplicate webhook delivery', deliveryId });
      return { ok: true, ignored: true, reason: 'duplicate_delivery' };
    }
    // mark as seen for 5 minutes
    await this.redis.set(dedupeKey, '1', 300);

    if (event === 'ping') {
      return { ok: true, event: 'ping' };
    }

    if (event !== 'push') {
      return { ok: true, ignored: true, event };
    }

    const payload = this.parseWebhookPayload(req.rawBody);
    // Timestamp validation: try to extract a commit timestamp and reject old deliveries (>5min)
    const tsCandidate = payload.head_commit?.timestamp ?? payload.repository?.pushed_at;
    if (tsCandidate) {
      try {
        const ts = new Date(tsCandidate).getTime();
        if (Date.now() - ts > 5 * 60 * 1000) {
          this.logger.warn({ msg: 'Stale webhook delivery', deliveryId, tsCandidate });
          return { ok: true, ignored: true, reason: 'stale_delivery' };
        }
      } catch {
        /* ignore parse errors */
      }
    }

    const ownerLogin = payload.repository?.owner?.login;

    if (!ownerLogin) {
      return { ok: true, ignored: true, reason: 'missing_repository_owner' };
    }

    const account = await this.findAccountByLogin(ownerLogin);

    if (!account) {
      return { ok: true, ignored: true, reason: 'account_not_found' };
    }

    const traceId = crypto.randomUUID();
    void this.githubService.runUserSync(account.userId, traceId);

    return { ok: true, queued: true, traceId };
  }



  /**
   * POST /api/v1/github/sync
   * Manually trigger a sync for the current user. Returns 202 immediately.
   */
  @Post('sync')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ short: { limit: 1, ttl: 1000 }, long: { limit: 1, ttl: 3600000 } })
  async triggerSync(@CurrentUser() user: AuthenticatedUser) {
    const traceId = crypto.randomUUID();
    void this.githubService.runScheduledSync(traceId);
    return { message: 'Sync started', traceId };
  }

  /**
   * GET /api/v1/github/repositories
   * Returns the list of synced repositories with their commit details.
   */
  @Get('repositories')
  @UseGuards(ClerkAuthGuard)
  @Throttle({ short: { limit: 3, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
  async listRepos(@CurrentUser() user: AuthenticatedUser) {
    const [repos, account] = await Promise.all([
      this.githubService.listRepositories(user.id),
      this.oauthService.getConnectedAccount(user.id),
    ]);
    return {
      repos,
      githubLogin: account?.login ?? null,
    };
  }

  private verifyWebhookSignature(signature: string | undefined, rawBody?: Buffer): void {
    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('GitHub webhook secret is not configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing GitHub signature');
    }

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing raw webhook body');
    }

    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
    const received = Buffer.from(signature);

    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Invalid GitHub webhook signature');
    }
  }

  private parseWebhookPayload(rawBody?: Buffer): any {
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing webhook body');
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as { repository?: { owner?: { login?: string } } };
    } catch {
      throw new BadRequestException('Invalid webhook JSON payload');
    }
  }

  private async findAccountByLogin(login: string) {
    return this.oauthService.getAccountByLogin(login);
  }
}
