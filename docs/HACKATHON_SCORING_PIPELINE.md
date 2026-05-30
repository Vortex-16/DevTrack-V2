# Hackathon Scoring Pipeline

The hackathon mode scoring pipeline is now wired into the API.

What it does:

- Filters file changes deterministically with `FileRelevanceFilter` before any scoring work.
- Scores each commit with `ScoringEngine` across implementation, test, breadth, consistency, and quality dimensions.
- Detects simple anomalies such as low-signal diffs, cramming, cosmetic-only edits, and quality risks.
- Persists `CommitAnalysis`, `FileChange`, `AnomalyEvent`, and `TeamProgressSnapshot` records when persistence is enabled.

Endpoint:

- `POST /api/v1/hackathons/:id/teams/:teamId/score`

Request shape:

- `commits[]` with `commitSha`, `commitMessage`, `committedAt`, and nested `files[]`
- optional `persist` flag for preview-only scoring

Notes:

- Only hackathon organizers can score a team batch.
- The pipeline uses the latest configured scoring weights for the hackathon if they exist; otherwise it falls back to the default weights.