import { Router } from "express";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import crypto from "crypto";

const router = Router();
router.use(authGuard);

router.get("/events", requireRole("auditor", "tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT e.*, c.sequence, c.hash, c.prev_hash FROM audit_log_events e JOIN audit_log_chain c ON c.event_id=e.id ORDER BY c.sequence DESC LIMIT 200")).rows);
  res.json(rows);
});

router.get("/verify-chain", requireRole("auditor", "tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT c.prev_hash, c.hash, e.payload FROM audit_log_chain c JOIN audit_log_events e ON e.id=c.event_id ORDER BY c.sequence ASC")).rows);
  let ok = true;
  for (const row of rows) {
    const computed = crypto.createHash("sha256").update(`${row.prev_hash}:${JSON.stringify(row.payload)}`).digest("hex");
    if (computed !== row.hash) {
      ok = false;
      break;
    }
  }
  res.json({ ok, checked: rows.length });
});

router.get("/pack/:allocationId", requireRole("auditor", "tenant_admin"), async (req: AuthRequest, res) => {
  const data = await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO download_logs (tenant_id,user_id,file_type,file_ref) VALUES ($1,$2,$3,$4)", [req.auth!.tenantId, req.auth!.userId, "audit_pack", null]);
    const tx = (await client.query("SELECT * FROM transactions WHERE allocation_id=$1", [req.params.allocationId])).rows;
    const approvals = tx.length ? (await client.query("SELECT * FROM approvals WHERE transaction_id = ANY($1)", [tx.map((x: any) => x.id)])).rows : [];
    const budgets = (await client.query("SELECT * FROM budgets WHERE allocation_id=$1", [req.params.allocationId])).rows;
    return { tx, approvals, budgets };
  });
  const manifest = {
    generatedAt: new Date().toISOString(),
    files: [
      { name: "transactions.json", checksum: crypto.createHash("sha256").update(JSON.stringify(data.tx)).digest("hex") },
      { name: "approvals.json", checksum: crypto.createHash("sha256").update(JSON.stringify(data.approvals)).digest("hex") },
      { name: "budgets.json", checksum: crypto.createHash("sha256").update(JSON.stringify(data.budgets)).digest("hex") }
    ]
  };
  res.json({ ...data, manifest });
});

export default router;
