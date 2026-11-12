# Data Model: SaaS Tenant Provisioning Foundation

## Existing entities
- **User**: Global authentication identity; current schema uses globally unique email.
- **Organization**: Tenant/workspace. Existing IDs must remain stable during migration.
- **Member**: User-to-organization relationship with role.
- **Session**: Authenticated user session with active organization; active organization must be revalidated against membership.

## Proposed conceptual entities

### Tenant provisioning request
- Unique request/idempotency key.
- Initiating user ID.
- Operation type (new workspace or invitation acceptance).
- Resulting organization ID.
- Status (pending, completed, failed/recoverable).
- Created and updated timestamps.

### Tenant audit event
- Organization ID when tenant-scoped.
- Actor user ID or platform actor identity.
- Event type and target entity type/identifier.
- Timestamp.
- Structured metadata that contains no secrets.

## Integrity requirements
- Every tenant-owned record references one organization.
- Membership is unique per (organization, user).
- Active session organization corresponds to a current membership.
- Child records cannot reference parents belonging to another organization.
- Tenant-scoped uniqueness includes organization ID where uniqueness is tenant-local.
- Existing IDs are not changed without a separate migration decision.

## Migration notes
No migration is authored in this design phase. Inventory all tables and constraints, inspect the migration journal, identify existing provisioning/audit equivalents, design composite keys and foreign keys, then test against a representative database copy.