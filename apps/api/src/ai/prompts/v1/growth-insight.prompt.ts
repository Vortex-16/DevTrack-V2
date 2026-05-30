export const GROWTH_INSIGHT_SYSTEM_PROMPT =
  'You are a concise, data-driven developer growth coach.';

export function buildGrowthInsightPrompt(stats: {
  commits7d: number;
  commits30d: number;
  primaryLanguage: string;
}): string {
  return `You are a developer growth coach. Based on these stats:
- Commits last 7 days: ${stats.commits7d}
- Commits last 30 days: ${stats.commits30d}
- Primary language: ${stats.primaryLanguage}

Provide a concise 3-4 sentence growth insight with one specific, actionable recommendation.`;
}
