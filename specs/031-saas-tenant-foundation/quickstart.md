# Quickstart: Tenant Provisioning Foundation

This guide is for local/staging verification after implementation, not production deployment.

## Prerequisites
- Node.js 22 and pnpm version pinned by package.json.
- Disposable PostgreSQL database.
- Representative copy of an existing CRM database for migration testing.
- No production WhatsApp credentials or real customer data in test environments.

## Verification scenarios
1. Start with an empty database and register two test users.
2. Confirm each registration creates one distinct organization, owner membership, default stages, and agent profile.
3. Sign in as a user with two memberships and switch active workspace.
4. Attempt to activate a workspace without membership; expect denial.
5. Revoke the active membership and confirm subsequent requests cannot access that workspace.
6. Run duplicate/concurrent provisioning requests and confirm idempotency.
7. Upgrade a copy of a single-organization database and verify existing IDs and CRM data remain intact.
8. Run cross-tenant negative tests for all inventoried API and background-processing surfaces.
9. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Release gate
Keep public registration disabled until all scenarios pass in staging and the tenant-isolation audit is complete.