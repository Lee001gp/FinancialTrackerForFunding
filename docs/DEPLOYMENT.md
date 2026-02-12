# DEPLOYMENT

## Local
1. `cp .env.example .env`
2. `docker compose up -d postgres`
3. `npm install`
4. `npm run migrate`
5. `npm run seed`
6. `npm run dev`

Worker:
- `node scripts/worker.js`

Demo credentials (local only):
- `platformadmin@local.test` / `Passw0rd!`
- `admin+deptofsport@local.test` / `Passw0rd!`
- `admin+deptofagriculture@local.test` / `Passw0rd!`
- `admin+acmeholdings@local.test` / `Passw0rd!`

## End-to-end demo path
1. Login to tenant.
2. Create allocation.
3. Submit budget.
4. Create transaction draft.
5. Upload proof.
6. Submit and review approve.
7. Generate report and CSV export.
8. Export audit pack.

Screenshots are stored under `/docs/screenshots`.

Demo screenshots:
- `/docs/screenshots/platform-admin-console.png`
- `/docs/screenshots/tenant-portal-console.png`
- `/docs/screenshots/counterparty-mobile-offline-sync.png`
