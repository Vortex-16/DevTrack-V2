import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Thin, rate-limit-aware wrapper over Octokit.
 * All GitHub API calls in the system go through this client.
 *
 * Rate limit strategy:
 * - Check remaining before each paginated batch
 * - If remaining < 100: pause and signal caller to skip remaining users
 * - Exponential backoff on 429 responses
 * - All calls log their rate limit cost for observability
 */
@Injectable()
export class GithubApiClient {
  private readonly logger = new Logger(GithubApiClient.name);

  createClient(token: string): Octokit {
    return new Octokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter: number, options: { method: string; url: string }, _octokit: Octokit, retryCount: number) => {
          this.logger.warn(
            `Rate limit hit for ${options.method} ${options.url}. Retry after ${retryAfter}s (attempt ${retryCount})`,
          );
          return retryCount < 2; // retry max 2 times
        },
        onSecondaryRateLimit: (_retryAfter: number, options: { method: string; url: string }) => {
          this.logger.warn(`Secondary rate limit: ${options.method} ${options.url}`);
          return false; // do not retry secondary limits
        },
      },
    });
  }

  async getRateLimitInfo(octokit: Octokit): Promise<RateLimitInfo> {
    const { data } = await octokit.rateLimit.get();
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      resetAt: new Date(data.rate.reset * 1000),
    };
  }

  isSafeToFetch(info: RateLimitInfo, minRemaining = 100): boolean {
    return info.remaining >= minRemaining;
  }
}
