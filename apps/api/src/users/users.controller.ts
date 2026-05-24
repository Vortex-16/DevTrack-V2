import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/v1/users/me — authenticated user's own profile */
  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  /** PATCH /api/v1/users/me/profile — update profile fields */
  @Patch('me/profile')
  @UseGuards(ClerkAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  /** GET /api/v1/users/p/:username — public profile (no auth required) */
  @Get('p/:username')
  async getPublicProfile(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.profile?.isPublic) {
      throw new NotFoundException('Profile not found');
    }
    // Only return public-safe fields
    return {
      username: user.username,
      plan: user.plan,
      profile: user.profile,
      createdAt: user.createdAt,
    };
  }
}
