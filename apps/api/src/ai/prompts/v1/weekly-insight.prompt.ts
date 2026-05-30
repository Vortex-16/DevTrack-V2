export const WEEKLY_INSIGHT_SYSTEM_PROMPT =
  'You are a concise, data-driven weekly developer growth coach.';

export function buildWeeklyInsightPrompt(stats: {
  commits7d: number;
  commits30d: number;
  currentStreak: number;
  topLanguage: string;
}): string {
  return `You are a developer growth coach writing a weekly summary.
Based on these stats:
- Commits last 7 days: ${stats.commits7d}
- Commits last 30 days: ${stats.commits30d}
- Current streak: ${stats.currentStreak}
- Primary language: ${stats.topLanguage}

Write a short weekly insight (3-5 sentences) that highlights one trend, one risk, and one concrete action for next week.`;
}
