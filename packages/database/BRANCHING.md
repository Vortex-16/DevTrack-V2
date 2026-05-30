Database branching for PRs (Neon)
================================

This file documents a minimal, free-tier friendly workflow to create temporary database branches for feature branches or PRs using Neon.

Why
----
- Isolate migrations and tests per-PR so CI runs against a fresh environment.

Quick steps (manual)
---------------------
1. Install Neon CLI: `npm install -g @neondatabase/cli` (or follow Neon docs).
2. Ensure `NEON_PROJECT` is set to your Neon project id (in CI or locally).
3. Create a branch for the PR (example):

   neon branch create pr-123 --project $NEON_PROJECT

4. Connect and get connection string (example):

   neon branch connect pr-123 --project $NEON_PROJECT

   The command prints a `DATABASE_URL` you can export locally or put in CI for the PR.

CI integration (recommended)
---------------------------
- In your CI workflow for PRs, create a short step that creates a branch named after the PR number, captures the connection string and exposes it as `DATABASE_URL` for subsequent steps (typecheck/migrate/test).
- Keep branches short-lived and delete them after PR close:

   neon branch delete pr-123 --project $NEON_PROJECT

Notes
-----
- Neon offers free branching for small projects — check your Neon plan and limits.
- If you don't use Neon, adapt these steps to your DB provider (e.g. Heroku PG forks, Docker ephemeral DBs).

Helper script
-------------
- A small PowerShell helper is provided at `./scripts/create_neon_branch.ps1` to make creating branches easier on Windows devs.
