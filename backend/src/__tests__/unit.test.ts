import { describe, it, expect } from "vitest";
import { evaluateCompliance } from "../services/compliance";
import { nextHash, verifyChain } from "../utils/auditChain";

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
    const p = { a: 1 };
    const h = nextHash("GENESIS", p);
    expect(verifyChain([{ prev_hash: "GENESIS", hash: h, payload: p }])).toBe(true);
  });

  it("detects tampering", () => {
    expect(verifyChain([{ prev_hash: "GENESIS", hash: "wrong", payload: { a: 1 } }])).toBe(false);
  });
});
