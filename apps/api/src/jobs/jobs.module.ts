import { Module } from '@nestjs/common';
import { GithubSyncJob } from './github-sync.job';
import { AiAnalysisJob } from './ai-analysis.job';
import { StreakComputeJob } from './streak-compute.job';
import { InsightGenJob } from './insight-gen.job';
import { GraphComputeJob } from './graph-compute.job';
import { DnaAnalysisJob } from './dna-analysis.job';
import { MomentumScanJob } from './momentum-scan.job';
import { SkillInferenceJob } from './skill-inference.job';
import { ReputationComputeJob } from './reputation-compute.job';
import { GithubModule } from '../github/github.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AiModule } from '../ai/ai.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';

/**
 * JobsModule — trigger-only.
 * Jobs contain ONLY @Cron() decorators that delegate to domain services.
 * Zero business logic lives here.
 * Swap @nestjs/schedule → BullMQ: only this module + job files change.
 */
@Module({
  imports: [GithubModule, AnalyticsModule, AiModule, IntelligenceModule],
  providers: [
    GithubSyncJob,
    AiAnalysisJob,
    StreakComputeJob,
    InsightGenJob,
    GraphComputeJob,
    DnaAnalysisJob,
    MomentumScanJob,
    SkillInferenceJob,
    ReputationComputeJob,
  ],
})
export class JobsModule {}
