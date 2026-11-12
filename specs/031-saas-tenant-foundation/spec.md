# Feature Specification: SaaS Tenant Provisioning Foundation

**Feature Branch**: `feature/saas-foundation`
**Created**: 2026-11-12
**Status**: Draft

## User Scenarios & Testing

### User Story 1 - External customer creates an independent workspace (P1)
A customer without a MatjarnaCOD marketplace account registers directly and receives a private workspace, owner membership, default pipeline, and agent profile.

**Independent Test**: Register two separate users in one deployment and verify that each receives a distinct workspace and neither can access the other's data.

**Acceptance Scenarios**:
1. Given public signup is enabled by platform policy, when a new user completes registration, then exactly one new organization is provisioned and the user becomes its owner.
2. Given two users register concurrently, when both requests complete, then each successful registration has one distinct organization.
3. Given provisioning fails, when registration is processed, then no partially provisioned tenant is left behind; the operation is safely retryable.
4. Given an existing user signs in, then no new organization is created.

### User Story 2 - User selects an authorized active workspace (P1)
A user who belongs to multiple organizations can select the workspace they intend to use. The CRM verifies membership before changing the active workspace.

**Independent Test**: Create one user with memberships in two organizations, switch between them, and verify session-bound API operations use only the selected authorized organization.

**Acceptance Scenarios**:
1. Given memberships in A and B, when the user selects B, then the session stores B only after server-side membership validation.
2. Given no membership in C, when the user attempts to activate C, then the request is rejected and the active workspace is unchanged.
3. Given active membership is revoked, when the next authenticated request is made, then access is denied.
4. Given exactly one membership, the CRM may select that membership as the default.

### User Story 3 - Existing installation is preserved (P1)
An existing deployment with one organization and CRM data can be upgraded without losing data or changing ownership unexpectedly.

**Independent Test**: Upgrade a representative pre-upgrade database copy and verify organization IDs and existing CRM records remain intact.

**Acceptance Scenarios**:
1. Existing organization and tenant-owned record IDs remain unchanged after migration.
2. Retrying a migration does not duplicate organizations, memberships, or seed records.
3. The existing owner can sign in and use current CRM features after upgrade.

## Edge Cases
- Concurrent signup or duplicate provisioning requests.
- User creation succeeds but tenant provisioning fails.
- User has multiple memberships and active membership is revoked.
- Session references a deleted organization.
- Organization has no owner.
- Invited user already has a CRM identity.
- Organization slug collision.
- Browser submits an organization ID without membership.
- A child record references a parent belonging to another organization.

## Functional Requirements
- **FR-001**: Support multiple organizations in one CRM deployment.
- **FR-002**: Provision each external customer's organization independently of other organizations.
- **FR-003**: Atomically create organization, owner membership, default pipeline stages, and default agent profile.
- **FR-004**: Make provisioning idempotent under retries and concurrency.
- **FR-005**: Resolve active organization only from a validated session and current membership.
- **FR-006**: Reject attempts to activate an organization for which the user has no membership.
- **FR-007**: Support users with memberships in multiple organizations.
- **FR-008**: Preserve existing organization IDs and CRM data during upgrade.
- **FR-009**: Preserve the existing single-organization installation as a valid tenant.
- **FR-010**: Scope every tenant-owned operation to the active authorized organization.
- **FR-011**: Do not enable public signup through an environment flag that bypasses provisioning, abuse controls, and platform policy.
- **FR-012**: Audit workspace creation, membership changes, and active-workspace changes.
- **FR-013**: Keep WordPress SSO and billing outside this foundation slice while preserving integration boundaries.
- **FR-014**: Preserve current CRM features and public bot API contracts.

## Key Entities
- **User**: Global authentication identity.
- **Organization / Tenant**: Isolated customer workspace.
- **Membership**: User-to-organization relationship with role.
- **Session**: Authenticated session with validated active organization.
- **Provisioning Operation**: Idempotent workspace creation request and outcome.
- **Audit Event**: Security-relevant tenant lifecycle record.

## Success Criteria
- **SC-001**: Two independent users create distinct workspaces in one deployment.
- **SC-002**: All defined cross-tenant access attempts are denied in automated tests.
- **SC-003**: Concurrent duplicate provisioning produces at most one workspace per idempotency key.
- **SC-004**: Existing single-organization database upgrades with existing IDs preserved.
- **SC-005**: Typecheck, lint, unit tests, build, and CRM regression tests pass.

## Assumptions
- A user may belong to multiple CRM organizations; active organization is selected per session.
- A new external user receives a new organization unless accepting a valid invitation.
- Organization is the CRM data security boundary.
- Global user email uniqueness is retained for the initial release.
- Public signup remains disabled until abuse controls and security gates pass.
- Billing and plan catalog are outside this feature slice.