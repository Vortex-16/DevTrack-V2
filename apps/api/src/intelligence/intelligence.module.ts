import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { DeveloperGraphService } from './developer-graph/developer-graph.service';
import { ProjectDnaService } from './project-dna/project-dna.service';
import { BuildMemoryService } from './build-memory/build-memory.service';
import { MomentumSignalService } from './momentum-signal/momentum-signal.service';
import { SkillConfidenceService } from './skill-confidence/skill-confidence.service';
import { DeveloperReputationService } from './developer-reputation/developer-reputation.service';
import { CoachSessionService } from './coach-session/coach-session.service';
import { CommitQualityService } from './commit-quality/commit-quality.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [IntelligenceController],
  providers: [
    DeveloperGraphService,
    ProjectDnaService,
    BuildMemoryService,
    MomentumSignalService,
    SkillConfidenceService,
    DeveloperReputationService,
    CoachSessionService,
    CommitQualityService,
  ],
  exports: [
    DeveloperGraphService,
    MomentumSignalService,
    SkillConfidenceService,
    DeveloperReputationService,
  ],
})
export class IntelligenceModule {}
