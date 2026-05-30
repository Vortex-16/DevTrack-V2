import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret, GetVerificationKey } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

interface ClerkJwtPayload {
  /** Clerk user ID — canonical identity */
  sub: string;
  /** Email from Clerk session claims */
  email?: string;
  /** Authorized party (must match CLERK_PUBLISHABLE_KEY domain) */
  azp?: string;
  /** Issuer — must match your Clerk instance URL */
  iss: string;
  exp: number;
  iat: number;
}

/**
 * Phase 4: Production Clerk JWT strategy using JWKS key rotation.
 *
 * How it works:
 *  1. Clerk signs JWTs with RS256 using rotating key pairs
 *  2. Public keys are published at: https://<your-clerk-domain>/.well-known/jwks.json
 *  3. jwks-rsa fetches and caches the active public key per JWT kid header
 *  4. passport-jwt validates the signature + expiry
 *  5. validate() does lazy user provisioning (find-or-create on first request)
 *
 * Mobile (React Native / Expo) compatibility:
 *  - Expo Clerk SDK sends standard Bearer tokens in Authorization header
 *  - Same validation flow as web — no changes needed for mobile
 *  - Token is fetched via `useAuth().getToken()` in the app
 *
 * Environment variables required:
 *  CLERK_JWKS_URL    = https://<your-clerk-instance>.clerk.accounts.dev/.well-known/jwks.json
 *  CLERK_ISSUER_URL  = https://<your-clerk-instance>.clerk.accounts.dev
 */
@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk-jwt') {
  private readonly logger = new Logger(ClerkStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const issuerUrl =
      configService.get<string>('CLERK_ISSUER_URL') ?? '';

    // JWKS URL: Clerk publishes rotating public keys here
    const jwksUri =
      configService.get<string>('CLERK_JWKS_URL') ??
      `${issuerUrl}/.well-known/jwks.json`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: configService.get<string>('NODE_ENV') === 'development',
      // jwks-rsa: fetches public key by kid, caches for 10min, rate-limited
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600_000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }) as GetVerificationKey,
      algorithms: ['RS256'],
    });

    if (!issuerUrl) {
      // Log a warning but don't crash — allows dev startup without Clerk configured
      console.warn(
        '[ClerkStrategy] CLERK_ISSUER_URL not set — JWT issuer validation disabled',
      );
    }
  }

  async validate(payload: ClerkJwtPayload): Promise<AuthenticatedUser> {
    const issuerUrl = this.configService.get<string>('CLERK_ISSUER_URL');

    // Validate issuer — prevents token reuse from other Clerk instances
    if (issuerUrl && payload.iss !== issuerUrl) {
      this.logger.warn({
        msg: 'JWT issuer mismatch',
        expected: issuerUrl,
        received: payload.iss,
      });
      throw new UnauthorizedException('Invalid token issuer');
    }

    // Lazy user provisioning — safe to call on every request
    // upsert in UsersService prevents race conditions on first login
    const user = await this.usersService.findOrCreateByClerkId({
      clerkId: payload.sub,
      email: payload.email ?? '',
    });

    this.logger.debug({ msg: 'JWT validated', userId: user.id });

    return {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      plan: user.plan,
      role: user.role,
    };
  }
}
