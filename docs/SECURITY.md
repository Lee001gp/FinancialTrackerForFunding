# SECURITY

- Argon2 password hashing.
- JWT auth with explicit tenant context.
- Row-level security plus app-level tenant context `SET LOCAL app.tenant_id`.
- Helmet headers and JSON payload size limits.
- File uploads capped at 10MB, filename sanitization, SHA256 hashes stored.
- Mandatory proof validation before transaction submission.
- Immutable audit events with hash chain.
- Rate limiting for login and upload endpoints.
- Download authorization + download logging for attachments, CSV exports, report PDFs, and audit packs.
- Account lockout on repeated failed login attempts.
- Password reset flow with expiring reset tokens.
- CSRF posture: API uses Bearer JWT authorization header (no cookie session), reducing CSRF surface.
