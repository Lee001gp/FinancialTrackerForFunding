# ROUTES AND NAV

## API route groups
- `/auth/login`, `/auth/logout`, `/auth/password-reset/request`, `/auth/password-reset/confirm`
- `/platform/tenants`, `/platform/users` (platform admin)
- `/tenant-users`
- `/tenant-config/features`, `/tenant-config/terms`, `/tenant-config/categories`, `/tenant-config/workflows`, `/tenant-config/custom-fields`
- `/programs`
- `/counterparties`, `/counterparties/:id/profile`, `/counterparties/:id/bank-accounts`
- `/allocations`
- `/budgets`
- `/transactions/draft`, `/transactions/drafts/offline-sync`, `/transactions/:id/attachments`, `/transactions/attachments/:attachmentId/download`, `/transactions/:id/submit`, `/transactions/:id/review`
- `/reports/generate`, `/reports/dashboard`, `/reports/exports/transactions.csv`, `/reports/:id/pdf`
- `/compliance/violations`, `/compliance/cases`, `/compliance/cases/:id`, `/compliance/cases/:id/events`
- `/audit/events`, `/audit/verify-chain`, `/audit/pack/:allocationId`

## Platform Admin app
- Dashboard
- Tenants CRUD
- Platform users CRUD
- System health
- Global settings card

## Tenant portal
- Dashboard
- Programs
- Allocations
- Review queue
- Compliance cases
- Reports/exports
- Audit tools
- Tenant config console
- User management

## Counterparty portal (mobile first)
Bottom tabs:
- Home
- Allocations
- Add Spend
- Tasks
- Profile

Add Spend wizard:
1. Select Allocation
2. Select Budget Line
3. Amount/date/vendor/description/payment
4. Upload Proof checklist
5. Submit or Save Draft
