import { Injectable } from '@nestjs/common';
import { RelevanceResult } from './file-relevance.filter';

export interface AiAdvisory {
  commitType: 'FEATURE' | 'FIX' | 'REFACTOR' | 'TEST' | 'DOCS' | 'CHORE';
  progressValue: number; // 0.0-1.0
  confidence: number; // 0.0-1.0
}

export interface DimensionScores {
  implementation: number; // 0-100
  test: number; // 0-100
  breadth: number; // 0-100
  consistency: number; // 0-100
  quality: number; // 0-100
}

export interface ScoreResult {
  dimensions: DimensionScores;
  totalScore: number; // 0-100, weighted
  relevanceMultiplier: number;
  aiConfidenceFactor: number;
}

export interface ScoringWeights {
  implementation: number;
  test: number;
  breadth: number;
  consistency: number;
  quality: number;
}

/**
 * ScoringEngine — deterministic scoring per Architecture 2.0.2 §3.
 *
 * The score is ALWAYS computed deterministically. AI output is advisory:
 * it contributes progress_value and a confidence factor that act as
 * multipliers, but never overrides the formula. This keeps scores
 * auditable and reproducible.
 *
 *   score = Σ(dimension_score × weight) × relevance_multiplier × ai_confidence_factor
 */
@Injectable()
export class ScoringEngine {
  /** Default dimension weights (sum = 1.0). Organizers can override per hackathon. */
  static readonly DEFAULT_WEIGHTS: ScoringWeights = {
    implementation: 0.35,
    test: 0.2,
    breadth: 0.15,
    consistency: 0.15,
    quality: 0.15,
  };

  /**
   * Compute a commit's score from relevant files + AI advisory signals.
   */
  scoreCommit(params: {
    relevantFiles: RelevanceResult[];
    additions: number;
    deletions: number;
    commitMessage: string;
    ai: AiAdvisory;
    commitGapsHours?: number[]; // gaps between recent commits for consistency
    weights?: ScoringWeights;
  }): ScoreResult {
    const weights = params.weights ?? ScoringEngine.DEFAULT_WEIGHTS;
    const { relevantFiles, additions, commitMessage, ai } = params;

    // ── Dimension 1: Implementation Progress (meaningful lines) ──
    const meaningfulLines = additions * this.avgRelevance(relevantFiles);
    const MAX_MEANINGFUL = 400; // a strong single commit
    const implementation = Math.min(100, (meaningfulLines / MAX_MEANINGFUL) * 100);

    // ── Dimension 2: Test Coverage Delta ──
    const testFiles = relevantFiles.filter((f) =>
      /\.(spec|test)\.|__tests__\//.test(f.filePath.toLowerCase()),
    ).length;
    const test = Math.min(100, testFiles * 40);

    // ── Dimension 3: Code Breadth (distinct domains touched) ──
    const domains = this.distinctDomains(relevantFiles);
    const breadth = Math.min(100, domains * 25);

    // ── Dimension 4: Consistency (commit cadence) ──
    const consistency = this.consistencyScore(params.commitGapsHours ?? []);

    // ── Dimension 5: Quality (AI confidence + message quality) ──
    const messageQuality = this.messageQuality(commitMessage);
    const quality = Math.min(100, ai.confidence * 60 + messageQuality * 40);

    const dimensions: DimensionScores = {
      implementation: this.round(implementation),
      test: this.round(test),
      breadth: this.round(breadth),
      consistency: this.round(consistency),
      quality: this.round(quality),
    };

    // ── Weighted sum × multipliers ──
    const weightedSum =
      dimensions.implementation * weights.implementation +
      dimensions.test * weights.test +
      dimensions.breadth * weights.breadth +
      dimensions.consistency * weights.consistency +
      dimensions.quality * weights.quality;

    const relevanceMultiplier = this.avgRelevance(relevantFiles) || 0.5;
    // progress_value modulates confidence factor (advisory)
    const aiConfidenceFactor = 0.5 + 0.5 * (ai.confidence * ai.progressValue);

    const totalScore = this.round(weightedSum * relevanceMultiplier * aiConfidenceFactor);

    return {
      dimensions,
      totalScore: Math.min(100, totalScore),
      relevanceMultiplier: this.round(relevanceMultiplier),
      aiConfidenceFactor: this.round(aiConfidenceFactor),
    };
  }

  /**
   * Rolling team score: 7-day rolling average × consistency bonus.
   */
  teamScore(commitScores: number[], consistencyBonus = 1.0): number {
    if (commitScores.length === 0) return 0;
    const avg = commitScores.reduce((a, b) => a + b, 0) / commitScores.length;
    return this.round(Math.min(100, avg * consistencyBonus));
  }

  private avgRelevance(files: RelevanceResult[]): number {
    if (files.length === 0) return 0;
    return files.reduce((s, f) => s + f.relevanceScore, 0) / files.length;
  }

  private distinctDomains(files: RelevanceResult[]): number {
    const domains = new Set<string>();
    for (const f of files) {
      const p = f.filePath.toLowerCase();
      if (/\.(tsx|jsx|css|html|vue|svelte)$/.test(p) || /components?\//.test(p)) domains.add('frontend');
      else if (/controller|service|route|handler|resolver/.test(p)) domains.add('backend');
      else if (/schema\.prisma$|migration|\.sql$/.test(p)) domains.add('database');
      else if (/\.(spec|test)\.|__tests__\//.test(p)) domains.add('tests');
      else if (/\.(ya?ml|toml)$|dockerfile|\.config\./.test(p)) domains.add('infra');
      else domains.add('other');
    }
    return domains.size;
  }

  private consistencyScore(gapsHours: number[]): number {
    if (gapsHours.length < 2) return 50; // neutral baseline with little data
    const mean = gapsHours.reduce((a, b) => a + b, 0) / gapsHours.length;
    if (mean === 0) return 50;
    const variance = gapsHours.reduce((s, g) => s + (g - mean) ** 2, 0) / gapsHours.length;
    const stdDev = Math.sqrt(variance);
    // Lower relative deviation → higher consistency
    const cadence = Math.max(0, 1 - stdDev / (mean + 1));
    return this.round(cadence * 100);
  }

  private messageQuality(message: string): number {
    if (!message) return 0;
    const len = message.split('\n')[0]?.length ?? 0;
    const conventional = /^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?:/i.test(message);
    let score = Math.min(0.7, len / 60); // length up to 60 chars
    if (conventional) score += 0.3;
    return Math.min(1, score);
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
