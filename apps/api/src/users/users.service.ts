import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Plan, User, Profile } from '@devtrack/database';

interface FindOrCreateInput {
  clerkId: string;
  email: string;
  username?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lazy user provisioning — called on every authenticated request via ClerkStrategy.
   * Creates the user + empty profile on first encounter; returns existing user thereafter.
   * This is intentionally idempotent and safe to call in hot paths.
   */
  async findOrCreateByClerkId(input: FindOrCreateInput): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { clerkId: input.clerkId },
    });

    if (existing) return existing;

    this.logger.log({
      msg: 'Provisioning new user',
      clerkId: input.clerkId,
      email: input.email,
    });

    // upsert prevents race condition on concurrent first requests
    return this.prisma.user.upsert({
      where: { clerkId: input.clerkId },
      create: {
        clerkId: input.clerkId,
        email: input.email,
        username: input.username ?? null,
        plan: Plan.FREE,
        profile: {
          create: { isPublic: false },
        },
      },
      update: {}, // no-op if already exists
    });
  }

  async findById(id: string): Promise<User & { profile: Profile | null }> {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(
    username: string,
  ): Promise<(User & { profile: Profile | null }) | null> {
    return this.prisma.user.findUnique({
      where: { username, deletedAt: null },
      include: { profile: true },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    // Validate username uniqueness if changing
    if (dto.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: dto.username, id: { not: userId } },
      });
      if (existing) throw new ConflictException('Username already taken');

      await this.prisma.user.update({
        where: { id: userId },
        data: { username: dto.username },
      });
    }

    return this.prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        bio: dto.bio ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        location: dto.location ?? null,
        website: dto.website ?? null,
        twitterUrl: dto.twitterUrl ?? null,
        linkedinUrl: dto.linkedinUrl ?? null,
        isPublic: dto.isPublic ?? false,
      },
      update: {
        bio: dto.bio ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        location: dto.location ?? null,
        website: dto.website ?? null,
        twitterUrl: dto.twitterUrl ?? null,
        linkedinUrl: dto.linkedinUrl ?? null,
        // isPublic is non-nullable boolean — omit from update if not provided
        ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
      },
    });
  }

  async softDelete(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    this.logger.warn({ msg: 'User soft-deleted', userId });
  }
}
