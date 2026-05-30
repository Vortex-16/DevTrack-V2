import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller({ path: 'analytics', version: '1' })
@UseGuards(ClerkAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getDashboardSummary(user.id);
  }

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getDashboardSummary(user.id);
  }

  @Get('streak')
  getCurrentStreak(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getDashboardSummary(user.id).then((d) => ({ currentStreak: d.currentStreak }));
  }

  @Get('streak/history')
  getStreakHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getStreakHistory(user.id, 90);
  }

  @Get('velocity')
  getVelocity(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getDashboardSummary(user.id).then((d) => ({ velocity: d.velocity }));
  }

  @Get('languages')
  getLanguages(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getLanguageBreakdown(user.id);
  }

  @Get('commits')
  getCommits(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getCommitsGraph(user.id, 30);
  }
}
