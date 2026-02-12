# TENANCY

Isolation controls:
1. Every tenant-scoped table includes `tenant_id`.
2. Middleware and DB helper establish active tenant for each request.
3. PostgreSQL RLS policy `tenant_isolation` checks `tenant_id = current_setting('app.tenant_id')`.
4. Auth token includes tenant id and route guards require it.
