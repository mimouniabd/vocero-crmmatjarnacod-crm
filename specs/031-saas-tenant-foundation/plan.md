# Implementation Plan: SaaS Tenant Provisioning Foundation

**Branch**: `feature/saas-foundation` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

## Summary
Replace first-organization-only signup with explicit, atomic tenant provisioning and validated active-organization selection. Preserve existing organization IDs and CRM data. This slice does not enable production public signup, implement WordPress SSO, or add billing.

## Technical Context
- Language: TypeScript 5.7+, Node.js 22, Next.js 15, React 19.
- Dependencies: Better Auth, Drizzle ORM, PostgreSQL, Zod, Vitest, Playwright.
- Storage: Dedicated PostgreSQL database owned by MatjarnaCOD CRM.
- Testing: Vitest, PostgreSQL integration tests, existing E2E harnesses, Playwright.
- Target: Linux container / Docker.
- Constraint: server-derived tenant identity; no WordPress database sharing; preserve existing public bot API contracts; public signup remains disabled until security gates pass.

## Constitution Check
- Security and tenant isolation: requires server-derived tenant context and negative cross-tenant tests.
- Quality: typecheck, lint, tests, build, and live behavior verification required.
- Specs before code: full cycle required because auth lifecycle and data model change.
- Product scope: SaaS expansion is authorized by the MatjarnaCOD CRM constitution amendment.
- This product-specific branch does not modify the upstream Vocero repository.

## Research Summary
- `onUserCreated()` currently creates an organization only when the global organization count is zero.
- `isPublicSignupAllowed()` closes public signup after the first organization unless ALLOW_SIGNUP is explicitly set.
- Session creation currently selects the first membership as active organization.
- `scoped()` requires a non-empty organization ID, but its existence does not prove every route, worker, webhook, file, cache, search, or export is tenant-safe.
- Better Auth organization plugin behavior and hook transaction boundaries must be verified against the pinned version before implementation.

## Design

### Provisioning
1. Validate registration or invitation request.
2. Authenticate or create the global user identity.
3. In a recoverable, idempotent operation, create or attach organization membership and default CRM records.
4. Record provisioning state so a retry can safely complete or recover.
5. Set active organization only after validating membership.
6. Record a security audit event.

Important: the current Better Auth post-user-create hook may run after user persistence. The implementation must not assume user creation and tenant provisioning share one transaction. Design an explicit recoverable workflow and test partial failure.

### Active organization
- Store selected organization in the authenticated session.
- Validate current membership on every session refresh and privileged operation.
- Never trust a browser-supplied organization ID as authorization.
- Default automatically only when the user has exactly one membership.
- Require explicit selection when multiple memberships exist.

### Data integrity
- Inventory every tenant-owned table and relationship.
- Review child-to-parent relationships such as lead-to-contact and lead-to-stage.
- Add tenant-aware composite constraints where practical so PostgreSQL rejects cross-tenant parent references.
- Preserve existing primary keys and organization IDs.
- Review uniqueness constraints and indexes for tenant scope.

### Migration and rollout
- Prefer additive migrations.
- Preserve the current organization ID and all existing tenant-owned IDs.
- Test migrations against a representative database copy.
- Keep public signup disabled until later platform policy and security gates are approved.

## Project Structure
- `src/server/auth/`: provisioning and membership resolution.
- `src/lib/auth/`: Better Auth integration and session hooks.
- `src/lib/db/schema.ts` and `drizzle/`: schema and migrations.
- `src/lib/api/`: authenticated request context and authorization.
- `src/app/api/`: workspace selection endpoint.
- `tests/unit/`: authorization and provisioning guards.
- `tests/e2e/`: signup, workspace switching, and isolation journeys.

## Risks
- Better Auth hook may execute after user persistence: implement recoverable idempotent provisioning.
- Existing routes may assume one organization: audit all access paths before enabling signup.
- Foreign keys may not encode same-tenant parent relationships: add safe composite constraints after backfill review.
- Multi-membership changes session semantics: test switching and revoked memberships.
- Existing database upgrade: validate against a representative copy.

## Rollout
1. Implement schema and server-side tenant context while signup remains disabled.
2. Run migrations and regression suite on staging copy.
3. Run negative tenant-isolation tests across every inventoried surface.
4. Enable controlled internal test accounts only.
5. Keep public signup and external SSO disabled until separate release approval.