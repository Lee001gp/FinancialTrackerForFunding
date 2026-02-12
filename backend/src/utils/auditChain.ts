import crypto from "crypto";

export type AuditHashInput = {
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: unknown;
  sequence: number;
  prevHash: string;
};

export const computeAuditHash = (input: AuditHashInput) => {
  const material = JSON.stringify(input);
  return crypto.createHash("sha256").update(material).digest("hex");
};

export const verifyChain = (
  items: {
    tenant_id: string;
    actor_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    payload: unknown;
    sequence: number;
    prev_hash: string;
    hash: string;
  }[]
) =>
  items.every((i) =>
    computeAuditHash({
      tenantId: i.tenant_id,
      actorId: i.actor_id,
      action: i.action,
      entityType: i.entity_type,
      entityId: i.entity_id,
      payload: i.payload,
      sequence: i.sequence,
      prevHash: i.prev_hash,
    }) === i.hash
  );
