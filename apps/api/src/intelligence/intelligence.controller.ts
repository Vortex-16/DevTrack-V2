import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClerkAuthGuard } from '../auth/clerk.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DeveloperGraphService } from './developer-graph/developer-graph.service';
import { ProjectDnaService } from './project-dna/project-dna.service';
import { BuildMemoryService, CreateMemoryDto, UpdateMemoryDto } from './build-memory/build-memory.service';
import { MomentumSignalService } from './momentum-signal/momentum-signal.service';
import { SkillConfidenceService } from './skill-confidence/skill-confidence.service';
import { DeveloperReputationService } from './developer-reputation/developer-reputation.service';
import { CoachSessionService, CreateCoachSessionDto } from './coach-session/coach-session.service';
import { CommitQualityService } from './commit-quality/commit-quality.service';

@Controller({ path: 'intelligence', version: '1' })
@ApiTags('intelligence')
@ApiBearerAuth('JWT')
@UseGuards(ClerkAuthGuard)
export class IntelligenceController {
  constructor(
    private readonly graphService: DeveloperGraphService,
    private readonly dnaService: ProjectDnaService,
    private readonly memoryService: BuildMemoryService,
    private readonly momentumService: MomentumSignalService,
    private readonly skillService: SkillConfidenceService,
    private readonly reputationService: DeveloperReputationService,
    private readonly coachService: CoachSessionService,
    private readonly qualityService: CommitQualityService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // DEVELOPER GRAPH
  // ─────────────────────────────────────────────────────────────

  @Get('graph')
  @ApiOperation({ summary: 'Get developer collaboration graph', description: 'Returns the latest developer graph snapshot showing collaboration network and centrality score' })
  @ApiResponse({ status: 200, description: 'Graph data retrieved successfully' })
  @ApiResponse({ status: 404, description: 'No graph data found for this user' })
  getGraph(@CurrentUser() user: AuthenticatedUser) {
    return this.graphService.getGraph(user.id);
  }

  @Get('graph/neighbors')
  getNeighbors(@CurrentUser() user: AuthenticatedUser) {
    return this.graphService.getNeighbors(user.id);
  }

  @Get('graph/score')
  getCentralityScore(@CurrentUser() user: AuthenticatedUser) {
    return this.graphService.getCentralityScore(user.id);
  }

  @Get('graph/history')
  getGraphHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.graphService.getGraphHistory(user.id, limit ? parseInt(limit) : 10);
  }

  // ─────────────────────────────────────────────────────────────
  // PROJECT DNA
  // ─────────────────────────────────────────────────────────────

  @Get('dna/:projectId')
  getDNA(@Param('projectId') projectId: string) {
    return this.dnaService.getDNA(projectId);
  }

  @Post('dna/:projectId/analyze')
  @HttpCode(HttpStatus.OK)
  analyzeDNA(@Param('projectId') projectId: string) {
    return this.dnaService.analyzeDNA(projectId);
  }

  @Get('dna/compare')
  compareDNA(
    @Query('project1') project1: string,
    @Query('project2') project2: string,
  ) {
    return this.dnaService.compareDNA(project1, project2);
  }

  // ─────────────────────────────────────────────────────────────
  // BUILD MEMORY
  // ─────────────────────────────────────────────────────────────

  @Post('memory')
  @HttpCode(HttpStatus.CREATED)
  createMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CreateMemoryDto,
  ) {
    return this.memoryService.create(user.id, data);
  }

  @Get('memory')
  listMemories(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tags') tags?: string,
  ) {
    const filters = tags ? { tags: tags.split(',') } : undefined;
    return this.memoryService.findAll(user.id, filters);
  }

  @Get('memory/search')
  searchMemories(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    return this.memoryService.search(user.id, query);
  }

  @Get('memory/:id')
  getMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memoryService.findOne(id, user.id);
  }

  @Patch('memory/:id')
  updateMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: UpdateMemoryDto,
  ) {
    return this.memoryService.update(id, user.id, data);
  }

  @Delete('memory/:id')
  @HttpCode(HttpStatus.OK)
  deleteMemory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.memoryService.delete(id, user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // MOMENTUM SIGNAL
  // ─────────────────────────────────────────────────────────────

  @Get('momentum')
  getCurrentMomentum(@CurrentUser() user: AuthenticatedUser) {
    return this.momentumService.getCurrentMomentum(user.id);
  }

  @Get('momentum/history')
  getMomentumHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.momentumService.getMomentumHistory(user.id, days ? parseInt(days) : 30);
  }

  @Get('momentum/burnout-risk')
  getBurnoutRisk(@CurrentUser() user: AuthenticatedUser) {
    return this.momentumService.getBurnoutRisk(user.id);
  }

  @Get('momentum/velocity')
  getVelocityTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.momentumService.getVelocityTrend(user.id, days ? parseInt(days) : 30);
  }

  // ─────────────────────────────────────────────────────────────
  // SKILL CONFIDENCE
  // ─────────────────────────────────────────────────────────────

  @Get('skills')
  getSkills(@CurrentUser() user: AuthenticatedUser) {
    return this.skillService.getSkills(user.id);
  }

  @Post('skills/infer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 1, ttl: 1000 }, long: { limit: 5, ttl: 3600000 } })
  inferSkills(@CurrentUser() user: AuthenticatedUser) {
    return this.skillService.inferSkills(user.id);
  }

  @Patch('skills/:skill')
  updateSkill(
    @CurrentUser() user: AuthenticatedUser,
    @Param('skill') skill: string,
    @Body('confidence') confidence: number,
  ) {
    return this.skillService.updateSkill(user.id, skill, confidence);
  }

  @Get('skills/:skill/evidence')
  getSkillEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('skill') skill: string,
  ) {
    return this.skillService.getEvidence(user.id, skill);
  }

  // ─────────────────────────────────────────────────────────────
  // DEVELOPER REPUTATION
  // ─────────────────────────────────────────────────────────────

  @Get('reputation')
  getReputation(@CurrentUser() user: AuthenticatedUser) {
    return this.reputationService.getReputation(user.id);
  }

  @Post('reputation/compute')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 1, ttl: 1000 }, long: { limit: 5, ttl: 3600000 } })
  computeReputation(@CurrentUser() user: AuthenticatedUser) {
    return this.reputationService.computeReputation(user.id);
  }

  @Get('reputation/breakdown')
  getReputationBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.reputationService.getBreakdown(user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // COACH SESSION
  // Rate limit: 10 sessions/day per user
  // ─────────────────────────────────────────────────────────────

  @Post('coach')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 2, ttl: 1000 }, long: { limit: 10, ttl: 86400000 } })
  createCoachSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CreateCoachSessionDto,
  ) {
    return this.coachService.createSession(user.id, data);
  }

  @Get('coach')
  getCoachSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.coachService.getSessions(user.id, limit ? parseInt(limit) : 20);
  }

  @Get('coach/:id')
  getCoachSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.coachService.getSession(id, user.id);
  }

  // ─────────────────────────────────────────────────────────────
  // COMMIT QUALITY
  // ─────────────────────────────────────────────────────────────

  @Get('commit-quality/:commitId')
  getCommitQuality(@Param('commitId') commitId: string) {
    return this.qualityService.getScore(commitId);
  }

  @Post('commit-quality/:commitId/score')
  @HttpCode(HttpStatus.OK)
  scoreCommit(@Param('commitId') commitId: string) {
    return this.qualityService.scoreCommit(commitId);
  }

  @Get('commit-quality/top')
  getTopCommits(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.qualityService.getTopCommits(user.id, limit ? parseInt(limit) : 10);
  }

  @Get('commit-quality/worst')
  getWorstCommits(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.qualityService.getWorstCommits(user.id, limit ? parseInt(limit) : 10);
  }
}
