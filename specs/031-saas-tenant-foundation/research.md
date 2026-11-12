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