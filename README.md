# Allocation & Spend Accountability Platform

Self-hostable multi-tenant accountability platform with backend API, PostgreSQL schema + RLS, seed data, DB-backed worker, docs, and three PWA-ready web apps.

## Quickstart
- docker compose up -d postgres
- npm install
- npm run migrate
- npm run seed
- npm run dev

Portals live under `frontend/`:
- `platform-admin`
- `tenant-portal`
- `counterparty-portal` (mobile-first spend wizard)
