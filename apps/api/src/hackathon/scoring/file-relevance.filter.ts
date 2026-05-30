import { Injectable } from '@nestjs/common';

export interface FileChangeInput {
  filePath: string;
  changeType: string; // added, modified, deleted
  additions: number;
  deletions: number;
}

export interface RelevanceResult {
  filePath: string;
  relevanceScore: number; // 0.0 - 1.0
  ruleBreakdown: { rule: string; score: number }[];
  isRelevant: boolean; // score >= threshold
}

/**
 * FileRelevanceFilter — deterministic scoring applied BEFORE any AI call.
 *
 * Per Architecture 2.0.2 §2.2: scores each changed file 0.0–1.0 using a
 * deterministic rule set. Files scoring below the threshold (0.4) are
 * discarded before AI classification — saving tokens and latency.
 */
@Injectable()
export class FileRelevanceFilter {
  /** Files scoring below this are discarded before AI analysis. */
  static readonly THRESHOLD = 0.4;

  /**
   * Score a single file path deterministically.
   * Returns a clamped 0.0–1.0 relevance score with a rule breakdown.
   */
  score(file: FileChangeInput): RelevanceResult {
    const path = file.filePath.toLowerCase();
    const breakdown: { rule: string; score: number }[] = [];

    // ── Negative signals (noise) — checked first, any match dominates ──
    if (this.matches(path, [/package-lock\.json$/, /yarn\.lock$/, /pnpm-lock\.yaml$/, /poetry\.lock$/, /cargo\.lock$/, /go\.sum$/])) {
      breakdown.push({ rule: 'lockfile', score: -1.0 });
    } else if (this.matches(path, [/node_modules\//, /vendor\//, /\.venv\//, /__pycache__\//])) {
      breakdown.push({ rule: 'dependencies', score: -1.0 });
    } else if (this.matches(path, [/^dist\//, /\/dist\//, /^build\//, /\/build\//, /coverage\//, /\.next\//, /\.turbo\//])) {
      breakdown.push({ rule: 'build-artifact', score: -1.0 });
    } else if (this.matches(path, [/\.min\.js$/, /\.bundle\./, /\.map$/])) {
      breakdown.push({ rule: 'generated-output', score: -1.0 });
    } else if (this.matches(path, [/\.(png|jpe?g|gif|svg|ico|woff2?|ttf|eot|mp4|webp)$/])) {
      breakdown.push({ rule: 'binary-asset', score: -0.8 });
    }
    // ── Positive signals (real engineering work) ──
    else if (this.matches(path, [/\.(spec|test)\./, /__tests__\//, /\.test\.[jt]sx?$/])) {
      breakdown.push({ rule: 'test-file', score: 0.8 });
    } else if (this.matches(path, [/migration/, /schema\.prisma$/, /\.sql$/])) {
      breakdown.push({ rule: 'schema-migration', score: 0.8 });
    } else if (this.matches(path, [/controller\./, /\.route\./, /routes\//, /handler\./, /resolver\./])) {
      breakdown.push({ rule: 'route-controller', score: 0.7 });
    } else if (this.matches(path, [/\.(ts|js|tsx|jsx|py|go|rs|java|rb|php|c|cpp|cs|swift|kt)$/])) {
      breakdown.push({ rule: 'source-code', score: 0.9 });
    } else if (this.matches(path, [/\.env\.example$/, /\.(ya?ml|toml)$/, /dockerfile/, /\.config\./])) {
      breakdown.push({ rule: 'configuration', score: 0.5 });
    } else if (this.matches(path, [/\.(md|txt|rst)$/, /readme/])) {
      breakdown.push({ rule: 'documentation', score: 0.3 });
    } else {
      breakdown.push({ rule: 'unknown', score: 0.2 });
    }

    // ── Formatting-only penalty: large file but tiny net change ──
    const totalChange = file.additions + file.deletions;
    if (totalChange > 0 && file.additions > 0 && file.deletions > 0) {
      const netRatio = Math.abs(file.additions - file.deletions) / totalChange;
      if (netRatio < 0.05 && totalChange > 50) {
        breakdown.push({ rule: 'formatting-only-penalty', score: -0.6 });
      }
    }

    // Sum and clamp to [0, 1]
    const raw = breakdown.reduce((sum, b) => sum + b.score, 0);
    const relevanceScore = Math.max(0, Math.min(1, raw));

    return {
      filePath: file.filePath,
      relevanceScore,
      ruleBreakdown: breakdown,
      isRelevant: relevanceScore >= FileRelevanceFilter.THRESHOLD,
    };
  }

  /**
   * Score a batch of files and return only the relevant ones plus aggregate stats.
   */
  filterRelevant(files: FileChangeInput[]) {
    const scored = files.map((f) => this.score(f));
    const relevant = scored.filter((s) => s.isRelevant);

    return {
      all: scored,
      relevant,
      relevantCount: relevant.length,
      discardedCount: scored.length - relevant.length,
    };
  }

  private matches(path: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(path));
  }
}
