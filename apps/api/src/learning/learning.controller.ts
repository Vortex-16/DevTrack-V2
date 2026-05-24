import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LearningService, CreateLearningLogDto } from './learning.service';

@Controller({ path: 'learning', version: '1' })
@UseGuards(ClerkAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.learningService.listLogs(user.id);
  }

  @Get('stats')
  async stats(@CurrentUser() user: AuthenticatedUser) {
    const [topics, totalMinutes] = await Promise.all([
      this.learningService.getTopics(user.id),
      this.learningService.getTotalMinutes(user.id),
    ]);
    return { topics, totalMinutes, totalHours: Math.round(totalMinutes / 60) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLearningLogDto) {
    return this.learningService.createLog(user.id, dto);
  }
}
