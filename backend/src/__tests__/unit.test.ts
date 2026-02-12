import { describe, it, expect } from "vitest";
import { evaluateCompliance } from "../services/compliance";
import { computeAuditHash, verifyChain } from "../utils/auditChain";

describe("compliance rules", () => {
  it("flags missing proof and over budget", () => {
    const v = evaluateCompliance({ amount: 150, date: "2025-01-01" }, [], 100, false);
    expect(v).toContain("missing_proof");
    expect(v).toContain("over_budget");
  });

  it("flags duplicate invoice", () => {
    const v = evaluateCompliance(
      { amount: 10, date: "2025-01-01", invoiceNumber: "INV-1" },
      [{ amount: 5, date: "2024-12-01", invoiceNumber: "INV-1" }],
      100,
      true
    );
    expect(v).toContain("duplicate_invoice");
  });

  it("flags round amount anomaly", () => {
    const v = evaluateCompliance({ amount: 200, date: "2025-01-01" }, [], 300, true);
    expect(v).toContain("round_amount_anomaly");
  });
});

describe("audit chain", () => {
  it("verifies deterministic chain", () => {
    const payload = { a: 1 };
    const hash = computeAuditHash({
      tenantId: "t1",
      actorId: "u1",
      action: "create",
      entityType: "allocation",
      entityId: "e1",
      payload,
      sequence: 1,
      prevHash: "GENESIS",
    });
    expect(
      verifyChain([
        {
          tenant_id: "t1",
          actor_id: "u1",
          action: "create",
          entity_type: "allocation",
          entity_id: "e1",
          payload,
          sequence: 1,
          prev_hash: "GENESIS",
          hash,
        },
      ])
    ).toBe(true);
  });

  it("detects tampering", () => {
    expect(
      verifyChain([
        {
          tenant_id: "t1",
          actor_id: "u1",
          action: "create",
          entity_type: "allocation",
          entity_id: "e1",
          payload: { a: 1 },
          sequence: 1,
          prev_hash: "GENESIS",
          hash: "wrong",
        },
      ])
    ).toBe(false);
  });
});
