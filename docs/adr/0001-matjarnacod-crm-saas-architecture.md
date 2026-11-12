# ADR-0001: MatjarnaCOD CRM SaaS Architecture

- **Status:** Accepted for implementation planning
- **Date:** 2026-11-12
- **Branch:** feature/saas-foundation

## Context

The upstream Vocero CRM is designed around a single deployed business/instance, although its data model already uses organizations and organization-scoped records. MatjarnaCOD CRM must serve multiple independent customer organizations from one operated SaaS product while preserving the existing CRM capabilities.

The product has two independent acquisition and authentication paths:
1. MatjarnaCOD marketplace users who launch CRM through a trusted WordPress integration.
2. External customers who register and subscribe directly to MatjarnaCOD CRM without a MatjarnaCOD marketplace account.

The WordPress marketplace and CRM must remain independently deployable and maintainable.

## Decisions

### 1. Separate CRM application and database

- Run the CRM as a separately deployed application, initially intended for `crm.matjarnacod.com`.
- Give the CRM its own PostgreSQL database and its own migration lifecycle.
- Do not share WordPress tables, WordPress database credentials, or direct SQL access between the products.
- Keep the WordPress connector as a separately versioned integration component.

### 2. Tenant model

- One CRM organization represents one tenant/customer workspace.
- Every tenant-owned record must be scoped to a tenant on the server side.
- Tenant identity must be derived from a validated session or signed service credential; never trust a tenant ID supplied by the browser.
- Tenant-owned files, caches, background jobs, search indexes, webhooks, analytics, and exports must preserve the same boundary.
- Cross-tenant access is denied by default, including for support and administrative workflows.

### 3. Authentication paths

**Marketplace SSO**
- WordPress authenticates the marketplace user.
- The connector exchanges a short-lived, signed, single-use assertion with the CRM backend over TLS.
- The CRM validates issuer, audience, expiry, nonce/replay protection, signature/key rotation, and the mapped marketplace identity.
- The CRM maps the identity to an explicitly linked CRM membership and tenant.
- The connector must not send WordPress passwords or long-lived WordPress session cookies to the CRM.

**External signup**
- External customers register directly with CRM authentication.
- Signup creates or joins a tenant according to an explicit invitation/ownership flow.
- External signup and marketplace SSO converge on the same CRM user, organization, membership, and authorization model.

### 4. SaaS control plane

Add a control-plane layer around the existing CRM domain:
- Tenant lifecycle and organization provisioning.
- Plans, subscriptions, trials, renewals, cancellation, and payment status.
- Entitlements and server-enforced quotas.
- Usage metering and billing records.
- Platform administrator console and audited support actions.
- Integration identity mapping and SSO gateway.

The existing CRM capabilities remain in the product core; do not rewrite them without a demonstrated need.

### 5. Billing boundary

- Implement billing behind a provider adapter so the payment processor can be changed.
- Treat provider webhooks as untrusted, authenticated, idempotent events.
- Enforce plan capabilities and limits in backend services and API handlers, not only in the UI.
- Payment failure or subscription expiry must follow a documented grace/restriction policy.
- Never automatically delete tenant data because a subscription expires.

### 6. WordPress integration boundary

- WordPress remains the marketplace and account-entry experience.
- The connector handles launch/SSO, account linking, and presentation/navigation integration.
- CRM owns CRM users, tenant authorization, CRM data, plans, and subscription enforcement.
- Cross-system communication uses versioned APIs and signed webhooks.
- The CRM must remain usable by external subscribers when WordPress is unavailable.

## Logical architecture

```text
                 MatjarnaCOD WordPress
                 Marketplace + Connector
                          |
                  Signed SSO / API
                          |
External Signup ---> MatjarnaCOD CRM SaaS
                          |
                SaaS Control Plane
          Tenant | Plans | Billing | Usage
                          |
                 Vocero CRM Core
      Inbox | Contacts | Pipeline | AI | Channels
                          |
                 Dedicated PostgreSQL
```

## Required implementation sequence

1. Inventory every tenant-owned table, query, API route, server action, webhook, job, file path, cache, and search path.
2. Document the existing organization bootstrap and auth lifecycle.
3. Define tenant provisioning and external signup behavior.
4. Define SSO identity mapping and replay-safe assertion contract.
5. Define plan/entitlement model and usage metering.
6. Add subscription provider adapter and idempotent webhook processing.
7. Add platform administration with audited privileged access.
8. Build the independent WordPress connector and versioned API contract.
9. Add automated tenant-isolation tests, including negative cross-tenant cases.
10. Verify both user journeys end-to-end before production enablement.

## Acceptance gates

- A marketplace user can enter the CRM without a second password prompt, and is mapped only to the intended tenant.
- An external customer can register, subscribe, and use CRM without a marketplace account.
- Tenant A cannot read, update, delete, export, search, or infer Tenant B's records.
- Background jobs and inbound webhooks cannot cross tenant boundaries.
- Entitlements and quotas are enforced server-side.
- Replayed payment/SSO webhooks or assertions do not duplicate effects.
- Subscription expiry restricts access according to policy but preserves customer data.
- CRM remains operational if the WordPress marketplace is unavailable.
- Existing CRM features remain covered by regression tests.

## Consequences

**Positive**
- One coherent SaaS product supports marketplace and direct customers.
- WordPress and CRM can be upgraded independently.
- Existing Vocero functionality is retained while SaaS capabilities are layered around it.

**Costs and risks**
- The current single-business signup assumptions must be redesigned.
- Tenant isolation needs a full audit, not just reliance on existing organization-scoped helpers.
- Billing, SSO, metering, support administration, and operational monitoring add substantial scope.
- Production rollout must wait for end-to-end security and isolation verification.

## Explicit non-goals for the first foundation milestone

- Replacing the existing CRM core.
- Sharing the WordPress and CRM databases.
- Requiring external subscribers to create a marketplace account.
- Enabling public SaaS signup before tenant isolation and abuse controls pass verification.
- Promising production readiness before end-to-end tests and deployment review.
