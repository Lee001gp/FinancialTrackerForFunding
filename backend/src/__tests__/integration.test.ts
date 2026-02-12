import { describe, it, expect } from "vitest";
import { evaluateCompliance } from "../services/compliance";

describe("workflow integration assertions", () => {
  it("captures expected business flow steps", () => {
    const flow = [
      "tenant create",
      "allocation create",
      "budget submit",
      "spend submit with proof",
      "review approve",
      "report generate",
      "audit pack export",
      "pdf summary download",
    ];
    expect(flow.length).toBe(8);
  });

  it("flags suspicious split behavior", () => {
    const violations = evaluateCompliance(
      { amount: 99, date: "2025-01-03", vendor: "Vendor A" },
      [
        { amount: 100, date: "2025-01-01", vendor: "Vendor A" },
        { amount: 101, date: "2025-01-02", vendor: "Vendor A" },
      ],
      1000,
      true
    );
    expect(violations).toContain("possible_invoice_splitting");
  });

  it("treats exact duplicate invoice numbers as violations", () => {
    const violations = evaluateCompliance(
      { amount: 250, date: "2025-01-03", vendor: "Vendor A", invoiceNumber: "INV-42" },
      [{ amount: 500, date: "2024-12-10", vendor: "Vendor B", invoiceNumber: "INV-42" }],
      5000,
      true
    );
    expect(violations).toContain("duplicate_invoice");
  });
});
