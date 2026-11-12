# Tasks: SaaS Tenant Provisioning Foundation

**Input**: Design documents in `specs/031-saas-tenant-foundation/`

**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/tenant-session.md

## Phase 1: Audit and test scaffolding

- [ ] T001 Inventory every tenant-owned table and foreign key in `src/lib/db/schema.ts` and `drizzle/`.
- [ ] T002 Inventory every authenticated route and its tenant-context source under `src/app/api/`.
- [ ] T003 Inventory background workers, webhook handlers, SSE, media, cache, search, and export paths under `src/server/` and `src/app/api/`.
- [ ] T004 [P] Add a source-level audit report covering tenant-owned access paths under `docs/`.
- [ ] T005 [P] Add test fixtures for two organizations and users with single/multiple memberships under `tests/`.

## Phase 2: Foundational authorization

- [ ] T006 Define a canonical server-side tenant context in `src/lib/auth/` or `src/lib/api/`.
- [x] T007 Replace first-membership selection in `src/server/auth/on-signup.ts` with explicit validated active-membership resolution (server-side membership validation is in place; workspace-switch endpoint remains separate).
- [ ] T008 Add an authenticated workspace-selection endpoint under `src/app/api/`.
- [ ] T009 Add unit tests proving a user cannot activate an organization without membership in `tests/unit/`.
- [ ] T010 Add tests for revoked/deleted active memberships in `tests/unit/`.
- [ ] T011 Verify Better Auth organization plugin behavior for multiple memberships and session updates; document pinned-version behavior in `specs/031-saas-tenant-foundation/research.md`.

## Phase 3: Atomic and recoverable tenant provisioning

- [ ] T012 Design provisioning idempotency and recovery state in `specs/031-saas-tenant-foundation/data-model.md`.
- [ ] T013 Add schema for provisioning requests and audit events in `src/lib/db/schema.ts`.
- [ ] T014 Generate and review additive migration using `pnpm db:generate` and `drizzle/`.
- [ ] T015 Implement transactional tenant provisioning service in `src/server/auth/`.
- [x] T016 Remove the global first-organization count gate from `src/server/auth/on-signup.ts`; each public signup now attempts to provision its own tenant. The dedicated provisioning service and failure recovery remain outstanding.
- [ ] T017 Update `src/server/auth/registration.ts` and `src/lib/auth/index.ts` so signup policy cannot bypass provisioning or abuse controls.
- [ ] T018 Update registration UI copy in `src/app/(auth)/register/page.tsx` for direct SaaS signup when platform policy permits.
- [ ] T019 Add concurrency, retry, partial-failure, and no-duplicate provisioning tests in `tests/unit/` and `tests/e2e/` (initial unit coverage added in `tests/unit/on-signup.test.ts`; full concurrency/E2E coverage and execution remain outstanding).

## Phase 4: Tenant data integrity

- [ ] T020 Review every child-to-parent relation in `src/lib/db/schema.ts` for cross-organization references.
- [ ] T021 Design and add tenant-aware composite unique keys/foreign keys where safe, with migration/backfill review.
- [ ] T022 Add negative cross-tenant tests for contacts, leads, stages, conversations, messages, settings, and attachments.
- [ ] T023 Add isolation tests for webhook routing, background workers, SSE, media, cache, search, and exports.

## Phase 5: Upgrade and regression verification

- [ ] T024 Test migration against a representative pre-upgrade single-organization database copy.
- [ ] T025 Verify existing organization ID, membership, contact, conversation, message, and pipeline record IDs remain unchanged.
- [ ] T026 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [ ] T027 Run live registration and workspace-selection E2E tests using test accounts only.
- [ ] T028 Run existing CRM regression E2E scenarios and verify `/api/bot/*` contracts are unchanged.
- [ ] T029 Document production release gates and keep public signup disabled until all critical tests pass.

## Dependencies

- Phase 1 audit must precede implementation of tenant authorization and provisioning.
- Phase 2 authorization design is required before multi-membership session switching.
- Phase 3 provisioning and Phase 4 data-integrity work depend on the audit and data model.
- Phase 5 verification depends on all implementation tasks.

## Release rule

Do not enable public SaaS signup or production tenant onboarding until all critical cross-tenant tests, migration tests, and existing CRM regression gates pass.