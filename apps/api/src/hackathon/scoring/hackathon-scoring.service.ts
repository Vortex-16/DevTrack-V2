import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnomalySeverity,
  AnomalyStatus,
  AnomalyType,
  CommitType,
  HackathonRole,
} from '@devtrack/database';
import { PrismaService } from '../../database/prisma.service';
import { FileRelevanceFilter, FileChangeInput, RelevanceResult } from './file-relevance.filter';
import { AiAdvisory, ScoringEngine, ScoringWeights, ScoreResult } from './scoring.engine';
import {
  HackathonCommitInputDto,
  ScoreHackathonTeamDto,
} from '../dto/scoring.dto';

type PersistedCommitResult = {
  id: string;
  commitSha: string;
  commitMessage: string;
  commitType: CommitType;
  totalScore: number;
  riskFlag: boolean;
  progressValue: number;
  confidence: number;
  relevanceScore: number;
  summary: string;
  dimensions: ScoreResult['dimensions'];
  anomalies: { type: AnomalyType; severity: AnomalySeverity; description: string }[];
};

type ScoredFile = FileChangeInput & RelevanceResult;

@Injectable()
export class HackathonScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relevanceFilter: FileRelevanceFilter,
    private readonly scoringEngine: ScoringEngine,
  ) {}

  async scoreTeam(
    hackathonId: string,
    teamId: string,
    userId: string,
    dto: ScoreHackathonTeamDto,
  ) {
    if (dto.commits.length === 0) {
      throw new BadRequestException('At least one commit is required');
    }

    await this.verifyOrganizer(hackathonId, userId);

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, hackathonId },
      select: { id: true, name: true, hackathonId: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const weights = await this.loadWeights(hackathonId);
    const commits = [...dto.commits].sort(
      (a, b) => new Date(a.committedAt).getTime() - new Date(b.committedAt).getTime(),
    );

    const results: PersistedCommitResult[] = [];
    let previousCommitAt: Date | null = null;

    for (const commit of commits) {
      const committedAt = new Date(commit.committedAt);
      if (Number.isNaN(committedAt.getTime())) {
        throw new BadRequestException(`Invalid committedAt for ${commit.commitSha}`);
      }

      const files = this.normalizeFiles(commit.files);
      const filtered = this.relevanceFilter.filterRelevant(files);
      const scoredFiles: ScoredFile[] = files.map((file, index): ScoredFile => ({
        ...file,
        ...(filtered.all[index] as RelevanceResult),
      }));
      const additions = this.totalAdditions(commit, files);
      const deletions = this.totalDeletions(commit, files);
      const advisory = this.buildAdvisory(commit, filtered.relevant, additions, deletions);
      const commitGapsHours = previousCommitAt
        ? [(committedAt.getTime() - previousCommitAt.getTime()) / 3_600_000]
        : [];
      const score = this.scoringEngine.scoreCommit({
        relevantFiles: filtered.relevant,
        additions,
        deletions,
        commitMessage: commit.commitMessage,
        ai: advisory,
        commitGapsHours,
        weights,
      });

      const anomalies = this.detectAnomalies({
        score,
        relevantFiles: filtered.relevant,
        allFiles: scoredFiles,
        additions,
        deletions,
        commitMessage: commit.commitMessage,
      });

      const persisted =
        dto.persist === false
          ? null
          : await this.persistCommitAnalysis({
              teamId,
              commit,
              committedAt,
              score,
              advisory,
              anomalies,
              files: scoredFiles,
            });

      results.push({
        id: persisted?.id ?? commit.commitSha,
        commitSha: commit.commitSha,
        commitMessage: commit.commitMessage,
        commitType: advisory.commitType,
        totalScore: score.totalScore,
        riskFlag: anomalies.some((anomaly) => anomaly.severity !== AnomalySeverity.LOW),
        progressValue: advisory.progressValue,
        confidence: advisory.confidence,
        relevanceScore: this.round(
          filtered.relevant.reduce((sum, file) => sum + file.relevanceScore, 0) /
            Math.max(filtered.relevant.length, 1),
        ),
        summary: this.buildSummary(commit, advisory, score, anomalies),
        dimensions: score.dimensions,
        anomalies,
      });

      previousCommitAt = committedAt;
    }

    const aggregate = this.aggregateResults(results);
    const riskLevel = this.riskLevel(results);

    if (dto.persist !== false) {
      await this.prisma.team.update({
        where: { id: team.id },
        data: { totalScore: aggregate.totalScore },
      });

      const snapshot = await this.prisma.teamProgressSnapshot.create({
        data: {
          teamId: team.id,
          hackathonId,
          totalScore: aggregate.totalScore,
          implementationScore: aggregate.implementationScore,
          testScore: aggregate.testScore,
          breadthScore: aggregate.breadthScore,
          consistencyScore: aggregate.consistencyScore,
          qualityScore: aggregate.qualityScore,
          anomalyCount: aggregate.anomalyCount,
          riskLevel,
        },
      });

      return {
        hackathonId,
        teamId: team.id,
        totalScore: aggregate.totalScore,
        snapshot,
        commits: results,
      };
    }

    return {
      hackathonId,
      teamId: team.id,
      totalScore: aggregate.totalScore,
      commits: results,
      preview: true,
    };
  }

  private async verifyOrganizer(hackathonId: string, userId: string) {
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { hackathonId_userId: { hackathonId, userId } },
      select: { role: true },
    });

    if (!participant || participant.role !== HackathonRole.ORGANIZER) {
      throw new ForbiddenException('Only organizers can score hackathon teams');
    }
  }

  private async loadWeights(hackathonId: string): Promise<ScoringWeights> {
    const weights = await this.prisma.scoringWeight.findMany({
      where: { hackathonId },
      orderBy: [{ dimension: 'asc' }, { version: 'desc' }],
    });

    const latest = new Map<string, number>();
    for (const weight of weights) {
      if (!latest.has(weight.dimension)) {
        latest.set(weight.dimension, weight.weight);
      }
    }

    return {
      implementation: latest.get('implementation') ?? ScoringEngine.DEFAULT_WEIGHTS.implementation,
      test: latest.get('test') ?? ScoringEngine.DEFAULT_WEIGHTS.test,
      breadth: latest.get('breadth') ?? ScoringEngine.DEFAULT_WEIGHTS.breadth,
      consistency: latest.get('consistency') ?? ScoringEngine.DEFAULT_WEIGHTS.consistency,
      quality: latest.get('quality') ?? ScoringEngine.DEFAULT_WEIGHTS.quality,
    };
  }

  private normalizeFiles(files: HackathonCommitInputDto['files']): FileChangeInput[] {
    return files.map((file) => ({
      filePath: file.filePath,
      changeType: file.changeType,
      additions: file.additions,
      deletions: file.deletions,
    }));
  }

  private totalAdditions(commit: HackathonCommitInputDto, files: FileChangeInput[]): number {
    return commit.additions ?? files.reduce((sum, file) => sum + file.additions, 0);
  }

  private totalDeletions(commit: HackathonCommitInputDto, files: FileChangeInput[]): number {
    return commit.deletions ?? files.reduce((sum, file) => sum + file.deletions, 0);
  }

  private buildAdvisory(
    commit: HackathonCommitInputDto,
    relevantFiles: RelevanceResult[],
    additions: number,
    deletions: number,
  ): AiAdvisory {
    const commitType = this.classifyCommit(commit.commitMessage);
    const relevantRatio = relevantFiles.length / Math.max(commit.files.length, 1);
    const changeIntensity = Math.min(1, (additions + deletions) / 400);
    const typeBoost =
      commitType === 'FEATURE' ? 0.25 : commitType === 'FIX' ? 0.18 : commitType === 'TEST' ? 0.15 : 0.1;

    return {
      commitType,
      progressValue: this.round(Math.min(1, 0.2 + relevantRatio * 0.45 + changeIntensity * 0.35 + typeBoost)),
      confidence: this.round(
        Math.min(
          1,
          0.35 + relevantRatio * 0.35 + (this.isConventionalMessage(commit.commitMessage) ? 0.2 : 0) +
            (commit.commitMessage.length > 20 ? 0.1 : 0),
        ),
      ),
    };
  }

  private classifyCommit(message: string): CommitType {
    const normalized = message.toLowerCase();
    if (/(test|spec)/.test(normalized)) return 'TEST';
    if (/(refactor|cleanup|restructure)/.test(normalized)) return 'REFACTOR';
    if (/(doc|readme|changelog)/.test(normalized)) return 'DOCS';
    if (/(fix|bug|hotfix|patch)/.test(normalized)) return 'FIX';
    if (/(chore|deps|dependency|build|ci)/.test(normalized)) return 'CHORE';
    return 'FEATURE';
  }

  private isConventionalMessage(message: string): boolean {
    return /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?:/i.test(message);
  }

  private detectAnomalies(params: {
    score: ScoreResult;
    relevantFiles: RelevanceResult[];
    allFiles: ScoredFile[];
    additions: number;
    deletions: number;
    commitMessage: string;
  }) {
    const anomalies: { type: AnomalyType; severity: AnomalySeverity; description: string }[] = [];
    const totalChange = params.additions + params.deletions;
    const relevantRatio = params.relevantFiles.length / Math.max(params.allFiles.length, 1);

    if (totalChange >= 120 && params.score.dimensions.test < 15) {
      anomalies.push({
        type: AnomalyType.CRAMMING,
        severity: AnomalySeverity.HIGH,
        description: 'Large commit with weak test coverage signal.',
      });
    }

    if (relevantRatio < 0.25 && totalChange >= 40) {
      anomalies.push({
        type: AnomalyType.LOW_SIGNAL,
        severity: AnomalySeverity.MEDIUM,
        description: 'Most changed files were filtered as low-signal or noise.',
      });
    }

    if (totalChange > 80 && params.score.dimensions.implementation < 20 && params.score.dimensions.quality < 35) {
      anomalies.push({
        type: AnomalyType.QUALITY_RISK,
        severity: AnomalySeverity.MEDIUM,
        description: 'Large diff with low implementation and quality score.',
      });
    }

    if (this.isLikelyFormattingOnly(params.allFiles, totalChange)) {
      anomalies.push({
        type: AnomalyType.COSMETIC,
        severity: AnomalySeverity.LOW,
        description: 'Commit appears to be mostly formatting or cosmetic work.',
      });
    }

    if (!this.isConventionalMessage(params.commitMessage) && params.score.totalScore < 30) {
      anomalies.push({
        type: AnomalyType.PADDING,
        severity: AnomalySeverity.LOW,
        description: 'Non-conventional commit message paired with a low-scoring change.',
      });
    }

    return anomalies;
  }

  private isLikelyFormattingOnly(files: ScoredFile[], totalChange: number): boolean {
    if (totalChange === 0) return false;

    const formattingFiles = files.filter((file) =>
      /\.(json|yml|yaml|md|css|scss|less|html|xml|toml|ini)$/.test(file.filePath.toLowerCase()),
    ).length;

    const balanced = files.every((file) => {
      const fileChange = file.additions + file.deletions;
      if (fileChange === 0) return true;
      return Math.abs(file.additions - file.deletions) / fileChange < 0.1;
    });

    return balanced && formattingFiles >= Math.ceil(files.length / 2) && totalChange <= 120;
  }

  private async persistCommitAnalysis(params: {
    teamId: string;
    commit: HackathonCommitInputDto;
    committedAt: Date;
    score: ScoreResult;
    advisory: AiAdvisory;
    anomalies: { type: AnomalyType; severity: AnomalySeverity; description: string }[];
    files: ScoredFile[];
  }) {
    const commitType = this.classifyCommit(params.commit.commitMessage);
    const baseData = {
      teamId: params.teamId,
      commitSha: params.commit.commitSha,
      commitMessage: params.commit.commitMessage,
      authorUsername: params.commit.authorUsername ?? null,
      committedAt: params.committedAt,
      commitType,
      summary: this.buildSummary(params.commit, params.advisory, params.score, params.anomalies),
      progressValue: params.advisory.progressValue,
      confidence: params.advisory.confidence,
      riskFlag: params.anomalies.some((anomaly) => anomaly.severity !== AnomalySeverity.LOW),
      implementationScore: params.score.dimensions.implementation,
      testScore: params.score.dimensions.test,
      breadthScore: params.score.dimensions.breadth,
      consistencyScore: params.score.dimensions.consistency,
      qualityScore: params.score.dimensions.quality,
      totalScore: params.score.totalScore,
      aiModel: 'heuristic-hackathon-v1',
    };

    const existing = await this.prisma.commitAnalysis.findUnique({
      where: { commitSha: params.commit.commitSha },
      select: { id: true },
    });

    if (existing) {
      return this.prisma.$transaction(async (tx) => {
        await tx.fileChange.deleteMany({ where: { commitAnalysisId: existing.id } });
        await tx.anomalyEvent.deleteMany({ where: { commitAnalysisId: existing.id } });

        return tx.commitAnalysis.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            fileChanges: {
              create: params.files.map((file) => ({
                filePath: file.filePath,
                changeType: file.changeType,
                additions: file.additions,
                deletions: file.deletions,
                relevanceScore: file.relevanceScore,
              })),
            },
            anomalyEvents: {
              create: params.anomalies.map((anomaly) => ({
                teamId: params.teamId,
                anomalyType: anomaly.type,
                severity: anomaly.severity,
                status: AnomalyStatus.OPEN,
                autoDetected: true,
                description: anomaly.description,
              })),
            },
          },
        });
      });
    }

    return this.prisma.commitAnalysis.create({
      data: {
        ...baseData,
        fileChanges: {
          create: params.files.map((file) => ({
            filePath: file.filePath,
            changeType: file.changeType,
            additions: file.additions,
            deletions: file.deletions,
            relevanceScore: file.relevanceScore,
          })),
        },
        anomalyEvents: {
          create: params.anomalies.map((anomaly) => ({
            teamId: params.teamId,
            anomalyType: anomaly.type,
            severity: anomaly.severity,
            status: AnomalyStatus.OPEN,
            autoDetected: true,
            description: anomaly.description,
          })),
        },
      },
    });
  }

  private buildSummary(
    commit: HackathonCommitInputDto,
    advisory: AiAdvisory,
    score: ScoreResult,
    anomalies: { type: AnomalyType; severity: AnomalySeverity; description: string }[],
  ): string {
    const anomalyNote = anomalies.length
      ? ` Anomalies: ${anomalies.map((anomaly) => anomaly.type).join(', ')}.`
      : '';

    return [
      `${advisory.commitType} commit scored ${score.totalScore.toFixed(2)}/100.`,
      `Progress ${Math.round(advisory.progressValue * 100)}% with confidence ${Math.round(advisory.confidence * 100)}%.`,
      `Message: ${commit.commitMessage.slice(0, 120)}${commit.commitMessage.length > 120 ? '…' : ''}.`,
      anomalyNote,
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private aggregateResults(results: PersistedCommitResult[]) {
    const commitCount = results.length;
    const dimensions = results.reduce(
      (acc, result) => {
        acc.implementationScore += result.dimensions.implementation;
        acc.testScore += result.dimensions.test;
        acc.breadthScore += result.dimensions.breadth;
        acc.consistencyScore += result.dimensions.consistency;
        acc.qualityScore += result.dimensions.quality;
        acc.totalScore += result.totalScore;
        acc.anomalyCount += result.anomalies.length;
        return acc;
      },
      {
        implementationScore: 0,
        testScore: 0,
        breadthScore: 0,
        consistencyScore: 0,
        qualityScore: 0,
        totalScore: 0,
        anomalyCount: 0,
      },
    );

    if (commitCount === 0) {
      return dimensions;
    }

    return {
      implementationScore: this.round(dimensions.implementationScore / commitCount),
      testScore: this.round(dimensions.testScore / commitCount),
      breadthScore: this.round(dimensions.breadthScore / commitCount),
      consistencyScore: this.round(dimensions.consistencyScore / commitCount),
      qualityScore: this.round(dimensions.qualityScore / commitCount),
      totalScore: this.round(dimensions.totalScore / commitCount),
      anomalyCount: dimensions.anomalyCount,
    };
  }

  private riskLevel(results: PersistedCommitResult[]): string {
    const anomalyCount = results.reduce((sum, result) => sum + result.anomalies.length, 0);
    const highSeverity = results.some((result) =>
      result.anomalies.some((anomaly) => anomaly.severity === AnomalySeverity.CRITICAL),
    );

    if (highSeverity) return 'CRITICAL';
    if (anomalyCount >= 4) return 'HIGH';
    if (anomalyCount >= 2) return 'MEDIUM';
    return 'LOW';
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}