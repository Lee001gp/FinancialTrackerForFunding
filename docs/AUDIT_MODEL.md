# AUDIT MODEL

- `audit_log_events` stores immutable business event payloads.
- `audit_log_chain` stores sequence, prev_hash, hash for tamper evidence.
- Chain hash = SHA256(tenant, actor, action, entity, payload, sequence, prev_hash).
- Every allocation create, budget submit, transaction create/upload/submit/review emits audit entries.
- Audit pack endpoint includes manifest checksums for reproducibility.
