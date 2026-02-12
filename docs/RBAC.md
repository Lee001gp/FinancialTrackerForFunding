# RBAC

## Roles
- `platform_admin`
- `tenant_admin`
- `program_manager`
- `reviewer`
- `auditor`
- `counterparty_user`

## Permissions matrix (high level)
- Platform tenants/users CRUD: `platform_admin`
- Tenant config (features/terms/categories/workflows/custom-fields): `tenant_admin`
- Tenant users CRUD: `tenant_admin`
- Program create/list: `tenant_admin`, `program_manager`
- Allocation create/list: `tenant_admin`, `program_manager`
- Budget submit: `counterparty_user`, `tenant_admin`
- Transaction draft/submit/attachments: `counterparty_user`, `tenant_admin`
- Transaction review decision: `reviewer`, `tenant_admin`
- Compliance cases create/update: `reviewer`, `tenant_admin`
- Compliance case read/events: `reviewer`, `tenant_admin`, `auditor`
- Audit log/events/pack: `auditor`, `tenant_admin`
- Reports export/PDF: `reviewer`, `tenant_admin`, `auditor`

## Enforcement
- API middleware `authGuard` validates JWT and active tenant claims.
- API middleware `requireRole` enforces role checks per route.
- Database layer enforces tenant isolation with RLS and `SET LOCAL app.tenant_id`.
