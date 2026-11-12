# Research: SaaS Tenant Provisioning Foundation

**Date:** 2026-11-12

## Confirmed from source
1. `src/server/auth/on-signup.ts`: the current user-created hook counts all organizations under a PostgreSQL advisory transaction lock, returns if any organization exists, uses the fixed slug `principal` for the first organization, creates owner membership/default stages/agent profile, and resolves the first membership as active.
2. `src/server/auth/registration.ts`: public signup is allowed only if `ALLOW_SIGNUP=true` or no organization exists.
3. `src/lib/auth/index.ts`: Better Auth uses Drizzle/PostgreSQL and the organization plugin; signup middleware checks the gate; user creation invokes `onUserCreated`; session creation assigns the first membership as active.
4. `src/lib/db/tenant.ts`: `scoped()` rejects an empty organization ID and combines it with query conditions.
5. `src/lib/db/schema.ts`: session stores `active_organization_id`; membership links users and organizations; domain records use required organization IDs and organization-first indexes.
6. `src/app/(auth)/register/page.tsx`: registration copy describes creating the initial organization for an instance.

## Inferences
- Signup lifecycle is intentionally single-organization-per-deployment.
- First-membership selection is insufficient for a user with multiple memberships.
- The `scoped()` helper does not prove every data access surface is isolated.
- Provisioning should be idempotent and recoverable because a post-create hook may run after user persistence.

## Not yet verified
- Exhaustive tenant isolation across routes, services, workers, webhooks, SSE, cache, media, search, and exports.
- Whether all child-to-parent relationships have tenant-aware composite constraints.
- Exact Better Auth plugin semantics for multiple organizations, invitations, active-organization switching, and hook transaction boundaries in the pinned version.
- Migration behavior against a representative database and production readiness.

## Better Auth organization client verification (2026-11-12)

- The lockfile resolves `better-auth` to version `1.6.23` (the package manifest allows compatible versions via `^1.1.14`).
- The project already configures `organizationClient()` in `src/lib/auth/client.ts`.
- The Better Auth v1.6 Organization documentation confirms `authClient.useListOrganizations()` for memberships and `authClient.organization.setActive({ organizationId })` for changing the session's active organization.
- The workspace selector uses these existing plugin APIs. The server still validates the selected organization against the user's current membership in `requireSession()`.
- The app refreshes the server-rendered route after a successful selection so tenant-scoped server components reload under the newly active organization.
- Remaining verification: run TypeScript, lint, unit tests and build against the actual lockfile installation; add a live multi-organization session-switch test and a negative non-member selection test.
