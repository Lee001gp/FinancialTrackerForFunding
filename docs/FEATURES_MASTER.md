# FEATURES MASTER

## Delivery status
- ✅ Core multi-tenant backend + RLS + tenant DB session context
- ✅ Expanded schema covering required domain groups including categories/custom fields
- ✅ API modules: auth, platform, tenant-users, tenant config, programs, counterparties, allocations, budgets, transactions, reports, compliance, audit
- ✅ Platform admin tenant + user management endpoints
- ✅ Tenant config console APIs: features, terms, categories, workflow templates, custom field definitions
- ✅ Counterparty onboarding APIs: profile + bank account versioning
- ✅ Compliance case management APIs: create, update status, event timeline
- ✅ Mandatory proof enforcement on submission
- ✅ Budget prerequisite enforcement for spend capture
- ✅ Over-budget + duplicate + anomaly compliance evaluation hooks on submit
- ✅ Append-only audit events + hash chain + audit pack manifest checksums
- ✅ Idempotency key support for critical transaction endpoints
- ✅ Rate limiting for auth login and file upload endpoints
- ✅ Download authorization + logging for attachments, exports, reports, and audit packs
- ✅ DB-backed jobs table + worker polling process with typed handlers
- ✅ PWA shell for all three portals
- ✅ Counterparty mobile-first add-spend flow with bottom nav
- ✅ Offline draft save + reconnect sync endpoint and UI wiring
- ✅ CSV export endpoint for transactions
- ✅ Seeded demo tenants, counterparties, allocations, and approved budgets
- ✅ PDF endpoint for report summaries (`/reports/:id/pdf`)
