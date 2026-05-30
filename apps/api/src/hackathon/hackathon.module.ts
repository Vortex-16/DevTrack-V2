import { Module } from '@nestjs/common';
import { HackathonController } from './hackathon.controller';
import { HackathonService } from './services/hackathon.service';
import { HackathonScoringService } from './scoring/hackathon-scoring.service';
import { FileRelevanceFilter } from './scoring/file-relevance.filter';
import { ScoringEngine } from './scoring/scoring.engine';

@Module({
  controllers: [HackathonController],
  providers: [HackathonService, HackathonScoringService, FileRelevanceFilter, ScoringEngine],
  exports: [HackathonService],
})
export class HackathonModule {}
