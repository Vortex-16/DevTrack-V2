import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { StreakService } from './streak.service';
import { VelocityService } from './velocity.service';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, StreakService, VelocityService],
  exports: [AnalyticsService, StreakService],
})
export class AnalyticsModule {}
