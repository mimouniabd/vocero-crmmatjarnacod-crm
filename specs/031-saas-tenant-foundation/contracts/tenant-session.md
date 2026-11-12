# Contract: Tenant Session and Workspace Selection

## Purpose
Define server-side selection of an active CRM organization. This contract does not define WordPress SSO or billing.

## Request
An authenticated user submits a target organization identifier to a workspace-selection operation.

## Authorization
- The server obtains user identity from the validated Better Auth session.
- The server checks for a current membership for (user ID, organization ID).
- The submitted organization identifier is a selection request only, never proof of authorization.
- If membership is absent, revoked, or inactive, reject the operation.
- On success, update the authenticated session's active organization.

## Expected behavior
- Success returns selected organization summary and refreshed session context.
- Unauthenticated requests are rejected.
- Non-member selection is rejected without changing the current active organization.
- Invalid or deleted organization identifiers are rejected without leaking whether an arbitrary organization exists.
- Subsequent tenant-scoped API operations derive organization context from the validated session.

## Security and compatibility
- Apply existing CSRF/session protections and rate limits.
- Audit successful switches and denied cross-tenant attempts without logging secrets.
- This is a new internal CRM contract; existing `/api/bot/*` public contracts remain unchanged.