import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { GithubTokenService } from './github-token.service';

interface OAuthStateEntry {
  userId: string;
  expiresAt: number;
}

interface GitHubTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

/**
 * GithubOAuthService — handles the full OAuth 2.0 authorization code flow.
 *
 * State management:
 *   In-memory Map with TTL (10 min). One state per user per auth attempt.
 *   Upgrade path: replace Map with Redis SETEX for multi-instance deployments.
 *
 * Security:
 *   - State is a UUID — prevents CSRF
 *   - State is consumed on first use (replay-safe)
 *   - Access token encrypted with AES-256-GCM before DB storage
 */
@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);
  private readonly stateStore = new Map<string, OAuthStateEntry>();
  private static readonly STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenService: GithubTokenService,
  ) {}

  // ── State management ──────────────────────────────────────────

  generateAuthUrl(userId: string): string {
    // Clean expired states first
    this.pruneExpiredStates();

    const state = crypto.randomUUID();
    this.stateStore.set(state, {
      userId,
      expiresAt: Date.now() + GithubOAuthService.STATE_TTL_MS,
    });

    const clientId = this.config.get<string>('GITHUB_CLIENT_ID') ?? '';
    const callbackUrl = this.config.get<string>('GITHUB_CALLBACK_URL') ??
      `${this.config.get<string>('API_URL')}/api/v1/github/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'read:user,repo',
      state,
    });

    this.logger.debug({ msg: 'Generated OAuth URL', userId, state });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  private consumeState(state: string): string | null {
    const entry = this.stateStore.get(state);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.stateStore.delete(state);
      return null;
    }
    this.stateStore.delete(state); // one-time use
    return entry.userId;
  }

  private pruneExpiredStates(): void {
    const now = Date.now();
    for (const [key, val] of this.stateStore) {
      if (now > val.expiresAt) this.stateStore.delete(key);
    }
  }

  // ── Code exchange ─────────────────────────────────────────────

  async handleCallback(code: string, state: string): Promise<string> {
    // 1. Validate state — prevents CSRF
    const userId = this.consumeState(state);
    if (!userId) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    // 2. Exchange code for access token
    const tokenData = await this.exchangeCode(code);
    if (tokenData.error) {
      throw new BadRequestException(`GitHub OAuth error: ${tokenData.error_description}`);
    }

    // 3. Fetch GitHub user info
    const ghUser = await this.fetchGithubUser(tokenData.access_token);

    // 4. Encrypt token and upsert GitHubAccount
    const encryptedToken = this.tokenService.encrypt(tokenData.access_token);

    await this.prisma.gitHubAccount.upsert({
      where: { userId },
      create: {
        userId,
        githubId: String(ghUser.id),
        login: ghUser.login,
        encryptedToken,
        scopes: tokenData.scope ? tokenData.scope.split(',').map((s) => s.trim()) : [],
      },
      update: {
        encryptedToken,
        scopes: tokenData.scope ? tokenData.scope.split(',').map((s) => s.trim()) : [],
        login: ghUser.login,
      },
    });

    this.logger.log({ msg: 'GitHub account connected', userId, login: ghUser.login });

    // 5. Return deep link for mobile redirect
    const deepLinkBase = this.config.get<string>('MOBILE_DEEP_LINK_BASE') ?? 'devtrack://oauth/github';
    return `${deepLinkBase}?success=true&login=${encodeURIComponent(ghUser.login)}`;
  }

  async disconnectAccount(userId: string): Promise<void> {
    await this.prisma.gitHubAccount.deleteMany({ where: { userId } });
    this.logger.log({ msg: 'GitHub account disconnected', userId });
  }

  async getConnectedAccount(userId: string) {
    return this.prisma.gitHubAccount.findUnique({
      where: { userId },
      select: { login: true, scopes: true, createdAt: true },
    });
  }

  // ── Private HTTP helpers ───────────────────────────────────────

  private async exchangeCode(code: string): Promise<GitHubTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.get<string>('GITHUB_CLIENT_ID'),
        client_secret: this.config.get<string>('GITHUB_CLIENT_SECRET'),
        code,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new BadRequestException(`GitHub token exchange failed: ${response.status}`);
    }

    return response.json() as Promise<GitHubTokenResponse>;
  }

  private async fetchGithubUser(token: string): Promise<GitHubUserResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'DevTrack/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch GitHub user info');
    }

    return response.json() as Promise<GitHubUserResponse>;
  }
}
