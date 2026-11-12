# MatjarnaCOD CRM — SaaS Readiness Audit

- **Date:** 2026-11-12
- **Branch:** `feature/saas-foundation`
- **Scope:** Initial source-level audit of authentication, organization provisioning, tenant schema, database setup, and current commercial capabilities.
- **Status:** Preliminary; not a production security certification.

## Executive summary

The codebase has useful foundations for tenant isolation: domain records carry a required `organization_id`, and a shared `scoped()` helper makes tenant filtering explicit in Drizzle queries. However, the current account lifecycle is still built around one initial organization per deployed instance. This is not yet a complete multi-customer SaaS control plane.

Do not enable public SaaS registration, paid subscriptions, or production multi-tenant onboarding based on the current implementation.

## Verified findings

### 1. Organization provisioning is single-instance oriented

Source: `src/server/auth/on-signup.ts`

- `onUserCreated()` obtains a global PostgreSQL advisory lock and counts all organizations.
- If any organization already exists, it returns without provisioning another one.
- The first organization is created with the fixed slug `principal`.
- The first user is assigned the `owner` role and default pipeline stages and agent profile are created.
- `resolveMembership()` returns the first membership for a user, and `resolveActiveOrganizationId()` uses that result.

Implication: a new external customer cannot currently receive a new tenant through the ordinary signup lifecycle once the first organization exists. Multi-organization membership selection also needs an explicit, validated active-tenant flow.

### 2. Public registration is deliberately closed after first organization

Sources:
- `src/server/auth/registration.ts`
- `src/lib/auth/index.ts`
- `src/app/(auth)/register/page.tsx`

- `isPublicSignupAllowed()` permits signup only when `ALLOW_SIGNUP=true` or the database contains zero organizations.
- The Better Auth before-hook applies this restriction to `/sign-up/email`.
- The current registration screen describes creating the initial organization and owner account.

Implication: external SaaS signup requires a redesigned signup/provisioning contract, abuse controls, and tenant creation flow. Merely setting `ALLOW_SIGNUP=true` is unsafe and insufficient for the intended SaaS model.

### 3. Existing tenant data model is a useful foundation, but needs a complete audit

Sources:
- `src/lib/db/schema.ts`
- `src/lib/db/tenant.ts`

Verified:
- The `organization` and `member` tables exist.
- The `session` table stores `active_organization_id`.
- Domain tables are documented and modeled with required `organization_id` fields and organization-first indexes.
- `scoped(organizationColumn, organizationId, ...conditions)` rejects an empty organization ID and combines the tenant predicate with other conditions.

Risks requiring further review:
- A helper existing does not prove every query, raw SQL statement, route, export, worker, webhook, cache, file operation, or search path uses it correctly.
- The membership resolution helper currently chooses the first membership rather than requiring an explicitly selected and authorized active organization.
- The organization slug `principal` is fixed during first-organization bootstrap; tenant provisioning must generate unique, stable slugs.
- The current schema uses a globally unique user email. The intended identity model must explicitly decide how one login can join multiple organizations without duplicating identities.
- Review composite foreign-key constraints so records cannot reference a contact, stage, or other parent belonging to a different organization.

### 4. Authentication currently has one integrated Better Auth configuration

Source: `src/lib/auth/index.ts`

- Better Auth uses the Drizzle PostgreSQL adapter and the organization plugin.
- A database hook provisions the initial organization after user creation.
- A session hook sets the active organization from the user's first membership.
- Signup restrictions are enforced in an auth middleware hook.

Implication: the CRM needs two supported entry paths that converge on the same identity and membership model:
1. Native external signup and login.
2. A trusted WordPress-to-CRM SSO exchange with signed, short-lived, replay-resistant assertions.

Do not pass WordPress passwords or long-lived WordPress session cookies to the CRM. Define account linking, identity collision, revocation, key rotation, and tenant authorization before implementing SSO.

### 5. No commercial subscription control plane was identified in the inspected project files

Source: `package.json` and the inspected auth/database modules.

- The inspected dependencies include Next.js, Better Auth, Drizzle, PostgreSQL, and application utilities.
- The inspected package scripts and auth lifecycle do not expose a ready subscription, plan, entitlement, or usage-metering system.

Implication: plans, subscriptions, billing adapter, entitlement enforcement, usage metering, invoices/payment state, and platform administration must be designed and implemented. This audit has not yet exhaustively searched every file for every possible billing reference.

### 6. Separate database boundary is already selected for this product

Decision: the CRM will own its PostgreSQL database. MatjarnaCOD WordPress will communicate through a separately versioned connector, authenticated APIs, and signed webhooks. No shared database or direct SQL coupling.

## Priority risks

| Priority | Risk | Required response |
|---|---|---|
| Critical | Cross-tenant data exposure through an unscoped path | Inventory and test every data access surface; add negative isolation tests |
| Critical | Incorrect tenant selected from first membership | Implement explicit active-tenant resolution and authorization |
| High | Single-organization signup lifecycle | Design atomic tenant provisioning for external and SSO paths |
| High | SSO identity collision or replay | Define signed assertion contract, nonce storage, expiry, audience, issuer, key rotation |
| High | Missing plan enforcement | Add server-side entitlements and quota checks |
| High | Tenant-owned resources outside SQL | Audit media, exports, queues, webhook routing, cache keys, SSE, and search |
| Medium | Fixed organization slug | Generate collision-safe tenant slugs |
| Medium | Support/admin access crossing tenant boundaries | Add least-privilege platform roles and immutable audit events |

## Implementation plan

### Phase 0 — Audit and specification (current)
- Preserve this audit.
- Inventory all tenant-owned tables and all server-side data-access entry points.
- Identify raw SQL, jobs, inbound webhook routing, file storage, cache keys, SSE, and exports.
- Write full specifications for tenant provisioning, active-tenant authorization, SSO, subscriptions, entitlements, and usage metering.
- No public signup or billing activation in this phase.

### Phase 1 — Tenant foundation
- Define the canonical tenant context and require it at server boundaries.
- Implement explicit organization provisioning as a transaction.
- Replace implicit first-membership selection with explicit active-organization selection and membership authorization.
- Add required uniqueness and composite relational constraints after data-impact review.
- Keep existing single-organization installations compatible through a documented migration/backfill.

### Phase 2 — External signup and platform administration
- Add controlled external registration with abuse/rate protections.
- Create tenant + owner membership + default CRM configuration atomically.
- Add platform-level admin roles, support audit trail, tenant suspension, and safe recovery procedures.

### Phase 3 — MatjarnaCOD SSO connector
- Implement WordPress connector separately.
- Exchange a signed, short-lived, single-use assertion over TLS.
- Validate issuer, audience, expiry, nonce, signature, and identity mapping server-side.
- Require explicit tenant membership mapping; do not infer tenant from an email address alone.

### Phase 4 — Plans, subscriptions, and entitlements
- Define plan catalog and feature/usage entitlements.
- Implement billing behind a replaceable provider adapter.
- Process payment webhooks idempotently.
- Enforce all entitlements server-side.
- Define trial, grace period, restriction, cancellation, renewal, and data-retention policies.

### Phase 5 — Security and production verification
- Automated cross-tenant negative tests across routes, services, workers, webhooks, files, search, cache, exports, and SSE.
- End-to-end external signup and WordPress SSO tests.
- End-to-end plan/limit/payment lifecycle tests.
- Regression test all existing Vocero CRM capabilities.
- Run typecheck, lint, unit tests, build, and live behavior tests.
- Keep production signup disabled until all critical gates pass.

## Open design decisions (not assumed)

The following require product confirmation before implementation:
- Payment provider and supported payment methods.
- Plan names, prices, included seats, message/AI usage, and quota rules.
- Trial duration and grace-period policy.
- Whether one user may belong to multiple CRM tenants in the first release.
- Exact WordPress account-to-CRM tenant mapping rules for suppliers and merchants.
- Data retention and export policy after cancellation.

## Source files reviewed

- `src/server/auth/registration.ts`
- `src/server/auth/on-signup.ts`
- `src/lib/auth/index.ts`
- `src/lib/db/tenant.ts`
- `src/lib/db/schema.ts`
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/login/page.tsx`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/onboarding/status/route.ts`
- `src/lib/db/index.ts`
- `package.json`
- `AGENTS.md`
