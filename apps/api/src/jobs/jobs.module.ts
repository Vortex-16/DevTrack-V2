import { Module } from '@nestjs/common';
import { GithubSyncJob } from './github-sync.job';
import { AiAnalysisJob } from './ai-analysis.job';
import { StreakComputeJob } from './streak-compute.job';
import { InsightGenJob } from './insight-gen.job';
import { GraphComputeJob } from './graph-compute.job';
import { DnaAnalysisJob } from './dna-analysis.job';
import { MomentumScanJob } from './momentum-scan.job';
import { GithubModule } from '../github/github.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiModule } from '../ai/ai.module';

/**
 * JobsModule — trigger-only.
 * Jobs contain ONLY @Cron() decorators that delegate to domain services.
 * Zero business logic lives here.
 * Swap @nestjs/schedule → BullMQ: only this module + job files change.
 */
@Module({
  imports: [GithubModule, AnalyticsModule, AiModule],
  providers: [
    GithubSyncJob,
    AiAnalysisJob,
    StreakComputeJob,
    InsightGenJob,
    GraphComputeJob,
    DnaAnalysisJob,
    MomentumScanJob,
  ],
})
export class JobsModule {}
