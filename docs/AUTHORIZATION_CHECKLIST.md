# Authorization Checklist — DevTrack V2

Purpose: centralize rules and a per-controller audit to ensure ownership and RBAC are applied consistently. Use this checklist during PR reviews and security audits.

Status legend: [✓] Done · [~] Partial · [ ] Not Started · [▶] In Progress

General rules
- [ ] All mutating endpoints must verify ownership via service-layer helpers (never raw `findUnique` in controllers).
- [ ] Service helpers should expose `findOwnedX(userId, id)` or `ensureOwnedX(userId, id)` returning the resource or throwing `NotFoundException`/`ForbiddenException`.
- [ ] Controllers should only call service helpers or use `OwnershipGuard` + `RequireOwnership` for fast paths.
- [ ] Public GET endpoints must intentionally return 404 for non-owned resources when existence should be hidden.
- [ ] Admin role bypass must be explicit and documented in service helpers.
- [ ] Soft-deleted resources (deletedAt != null) must be hidden from normal users.

Checklist per controller

- `ProjectsController`: [✓] Done — `ProjectsService` verifies ownership in `addTask`, `updateTaskStatus`, `archiveProject`. Controller uses `OwnershipGuard` where appropriate.
- `TasksController`: [ ] Not Present — task endpoints live under `ProjectsController` and are covered.
- `LearningController`: [✓] Done — `LearningService` methods accept `userId` and persist/query scoped to `userId`.
- `ProfilesController` / `UsersController`: [~] Partial — public profile route uses `findByUsername` with `deletedAt: null`. `updateProfile` uses `userId` in service. Consider adding `ensureOwnedProfile(userId, userId)` helper for consistency.
- `AnalyticsController`: [✓] Done — service methods accept `userId` and query scoped data. No inline owner checks in controllers.
- `GithubController`: [~] Partial — webhook is unauthenticated and validated differently; all user-scoped endpoints (`connect`, `status`, `disconnect`, `repositories`, `sync`) delegate to services with `userId` where applicable. Verify `oauthService.disconnectAccount` and `githubService.listRepositories` enforce user scoping.
- `AiController`: [~] Partial — moved AI insight/repo-analysis ownership checks into `AiService`. Confirm other endpoints that accept IDs use service helpers or `OwnershipGuard`.
- `HealthController`: [✓] N/A — health is public and safe.
- `Admin / Internal` endpoints: [ ] Not Started — ensure any admin-only endpoints require `@Roles('admin')`.

Audit notes
- Prefer `findFirst({ where: { id, userId } })` to avoid leaking resource existence when using `findUnique({ where: { id } })` that doesn't check `userId`.
- For records linked via `repositoryId`, prefer `findFirst({ where: { id, repository: { userId } } })` or load `repositoryId` and check ownership via `repository` service.
- Use `NotFoundException` to hide existence details for foreign resources, or `ForbiddenException` when you explicitly want to reveal existence.

Next actions
- [▶] Sweep remaining controllers to centralize ownership checks into services and replace inline checks (in progress).
- [ ] Add per-controller unit tests verifying unauthorized access returns 404/403 as configured.
- [ ] Document admin overrides and who can bypass ownership checks.

If you want a generated PR that applies these service helpers and tests, say so and I will implement them sequentially.
