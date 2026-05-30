export function buildRepoAnalysisPrompt(stats: {
  commits7d: number;
  commits30d: number;
  topLanguage: string;
}): string {
  return `You are a developer growth coach. Based on these stats:
- Commits last 7 days: ${stats.commits7d}
- Commits last 30 days: ${stats.commits30d}
- Primary language: ${stats.topLanguage}

Provide a concise (3-4 sentences) growth insight with one specific, actionable recommendation. Be encouraging but honest.`;
}
