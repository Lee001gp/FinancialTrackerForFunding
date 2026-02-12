import { Router } from "express";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { v4 as uuid } from "uuid";

const router = Router();
router.use(authGuard);

router.post("/generate", requireRole("reviewer", "tenant_admin"), async (req: AuthRequest, res) => {
  const id = uuid();
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO reports (id,tenant_id,name,status,generated_by,metadata) VALUES ($1,$2,$3,'ready',$4,$5)", [id, req.auth!.tenantId, req.body.name || "Monthly Report", req.auth!.userId, { period: req.body.period || "monthly" }]);
  });
  res.status(201).json({ id });
});

router.get("/dashboard", async (req: AuthRequest, res) => {
  const summary = await withTenant(req.auth!.tenantId, async (client) => {
    const a = await client.query("SELECT count(*)::int AS allocations FROM allocations");
    const t = await client.query("SELECT count(*)::int AS tx, coalesce(sum(amount),0)::numeric AS spend FROM transactions WHERE status='approved'");
    const v = await client.query("SELECT count(*)::int AS violations FROM rule_violations");
    return { allocations: a.rows[0].allocations, approvedTransactions: t.rows[0].tx, approvedSpend: t.rows[0].spend, violations: v.rows[0].violations };
  });
  res.json(summary);
});

router.get("/exports/transactions.csv", requireRole("reviewer", "tenant_admin", "auditor"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO download_logs (tenant_id,user_id,file_type,file_ref) VALUES ($1,$2,$3,$4)", [req.auth!.tenantId, req.auth!.userId, "transactions_csv", null]);
    return (await client.query("SELECT id,allocation_id,budget_line_id,amount,invoice_number,status,transaction_date FROM transactions ORDER BY created_at DESC LIMIT 10000")).rows;
  });
  const header = "id,allocation_id,budget_line_id,amount,invoice_number,status,transaction_date";
  const csv = [header, ...rows.map((r: any) => [r.id, r.allocation_id, r.budget_line_id || "", r.amount, r.invoice_number || "", r.status, r.transaction_date].join(","))].join("\n");
  res.setHeader("content-type", "text/csv");
  res.send(csv);
});


router.get("/:id/pdf", requireRole("reviewer", "tenant_admin", "auditor"), async (req: AuthRequest, res) => {
  const report = await withTenant(req.auth!.tenantId, async (client) => {
    const r = (await client.query("SELECT * FROM reports WHERE id=$1", [req.params.id])).rows[0];
    if (r) await client.query("INSERT INTO download_logs (tenant_id,user_id,file_type,file_ref) VALUES ($1,$2,$3,$4)", [req.auth!.tenantId, req.auth!.userId, "report_pdf", r.id]);
    return r;
  });
  if (!report) return res.status(404).json({ code: "NOT_FOUND", message: "Report not found" });
  const pdf = `%PDF-1.1\n1 0 obj<<>>endobj\n2 0 obj<< /Length 44 >>stream\nBT /F1 12 Tf 50 700 Td (Report: ${report.name}) Tj ET\nendstream endobj\n3 0 obj<< /Type /Catalog /Pages 4 0 R >>endobj\n4 0 obj<< /Type /Pages /Kids [5 0 R] /Count 1 >>endobj\n5 0 obj<< /Type /Page /Parent 4 0 R /MediaBox [0 0 612 792] /Contents 2 0 R >>endobj\nxref\n0 6\n0000000000 65535 f \ntrailer<< /Root 3 0 R /Size 6 >>\nstartxref\n0\n%%EOF`;
  res.setHeader("content-type", "application/pdf");
  res.send(Buffer.from(pdf));
});

export default router;
