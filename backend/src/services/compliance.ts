export type TxSignal = { amount: number; invoiceNumber?: string; vendor?: string; date: string };

export const evaluateCompliance = (tx: TxSignal, history: TxSignal[], budgetRemaining: number, hasProof: boolean) => {
  const violations: string[] = [];
  if (!hasProof) violations.push("missing_proof");
  if (tx.amount > budgetRemaining) violations.push("over_budget");
  if (tx.invoiceNumber && history.some((h) => h.invoiceNumber === tx.invoiceNumber)) violations.push("duplicate_invoice");
  const vendorTx = history.filter((h) => h.vendor && h.vendor === tx.vendor);
  const splitCount = vendorTx.filter((h) => Math.abs(h.amount - tx.amount) < 5).length;
  if (splitCount >= 2 && tx.amount < 1000) violations.push("possible_invoice_splitting");
  if (Math.round(tx.amount) === tx.amount) violations.push("round_amount_anomaly");
  return violations;
};
