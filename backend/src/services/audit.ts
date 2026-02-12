import crypto from "crypto";

export const appendAudit = async (client: any, tenantId: string, actorId: string, action: string, entityType: string, entityId: string, payload: unknown) => {
  const prev = await client.query("SELECT sequence, hash FROM audit_log_chain WHERE tenant_id=$1 ORDER BY sequence DESC LIMIT 1", [tenantId]);
  const nextSeq = (prev.rows[0]?.sequence || 0) + 1;
  const prevHash = prev.rows[0]?.hash || "GENESIS";
  const material = JSON.stringify({ tenantId, actorId, action, entityType, entityId, payload, nextSeq, prevHash });
  const hash = crypto.createHash("sha256").update(material).digest("hex");

  const event = await client.query(
    `INSERT INTO audit_log_events (tenant_id, actor_id, action, entity_type, entity_id, payload)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [tenantId, actorId, action, entityType, entityId, payload]
  );

  await client.query(
    `INSERT INTO audit_log_chain (tenant_id, event_id, sequence, prev_hash, hash)
     VALUES ($1,$2,$3,$4,$5)`,
    [tenantId, event.rows[0].id, nextSeq, prevHash, hash]
  );
};
