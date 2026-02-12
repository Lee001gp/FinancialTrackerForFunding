import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";
import { env } from "../config/env";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { evaluateCompliance } from "../services/compliance";
import { AppError } from "../middleware/errors";
import { rateLimit } from "../middleware/rateLimit";

fs.mkdirSync(env.uploadsPath, { recursive: true });
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();
router.use(authGuard);

router.post("/draft", requireRole("counterparty_user", "tenant_admin"), requireIdempotencyKey, async (req: AuthRequest, res, next) => {
  try {
    const id = uuid();
    const { allocationId, budgetLineId, amount, invoiceNumber, description, vendor, date, paymentMethod } = req.body;
    await withTenant(req.auth!.tenantId, async (client) => {
      const approvedBudget = await client.query("SELECT 1 FROM budgets WHERE allocation_id=$1 AND status='approved'", [allocationId]);
      if (approvedBudget.rowCount === 0) throw new AppError("BUDGET_REQUIRED", "No approved budget", 422);
      await client.query(
        "INSERT INTO transactions (id,tenant_id,allocation_id,budget_line_id,amount,invoice_number,description,vendor,transaction_date,payment_method,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11)",
        [id, req.auth!.tenantId, allocationId, budgetLineId, amount, invoiceNumber, description, vendor || null, date || new Date().toISOString(), paymentMethod || null, req.auth!.userId]
      );
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "transaction.create", "transaction", id, req.body);
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

router.post("/drafts/offline-sync", requireRole("counterparty_user", "tenant_admin"), requireIdempotencyKey, async (req: AuthRequest, res, next) => {
  try {
    const drafts = Array.isArray(req.body?.drafts) ? req.body.drafts : [];
    const created: string[] = [];
    await withTenant(req.auth!.tenantId, async (client) => {
      for (const draft of drafts) {
        const id = uuid();
        await client.query(
          "INSERT INTO transactions (id,tenant_id,allocation_id,budget_line_id,amount,invoice_number,description,vendor,transaction_date,payment_method,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11)",
          [id, req.auth!.tenantId, draft.allocationId, draft.budgetLineId, draft.amount, draft.invoiceNumber || null, draft.description || null, draft.vendor || null, draft.date || new Date().toISOString(), draft.paymentMethod || null, req.auth!.userId]
        );
        created.push(id);
      }
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "transaction.offline_sync", "transaction", "00000000-0000-0000-0000-000000000000", { count: created.length });
    });
    res.status(201).json({ createdCount: created.length, ids: created });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/attachments", requireRole("counterparty_user", "tenant_admin"), rateLimit(30, 60_000, "upload"), requireIdempotencyKey, upload.single("file"), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) throw new AppError("FILE_REQUIRED", "Upload required", 400);
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(req.file.mimetype)) throw new AppError("FILE_TYPE_NOT_ALLOWED", "Only jpeg/png/pdf allowed", 415);

    const sanitized = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filepath = path.join(env.uploadsPath, sanitized);
    fs.writeFileSync(filepath, req.file.buffer);
    const sha = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

    await withTenant(req.auth!.tenantId, async (client) => {
      const v = await client.query("SELECT COALESCE(max(version),0)+1 as v FROM attachments WHERE transaction_id=$1", [req.params.id]);
      await client.query(
        "INSERT INTO attachments (id,tenant_id,transaction_id,original_name,storage_path,mime_type,size_bytes,sha256,version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [uuid(), req.auth!.tenantId, req.params.id, req.file.originalname, filepath, req.file.mimetype, req.file.size, sha, v.rows[0].v]
      );
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "attachment.upload", "transaction", req.params.id, { file: req.file.originalname });
    });

    res.json({ ok: true, sha256: sha });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/submit", requireRole("counterparty_user", "tenant_admin"), requireIdempotencyKey, async (req: AuthRequest, res, next) => {
  try {
    await withTenant(req.auth!.tenantId, async (client) => {
      const tx = (await client.query("SELECT * FROM transactions WHERE id=$1", [req.params.id])).rows[0];
      if (!tx) throw new AppError("NOT_FOUND", "Transaction not found", 404);
      const proofCount = (await client.query("SELECT count(*)::int AS c FROM attachments WHERE transaction_id=$1", [req.params.id])).rows[0].c;
      if (proofCount < 1) throw new AppError("PROOF_REQUIRED", "Missing mandatory proof", 422);

      const budgetLine = (await client.query("SELECT amount FROM budget_lines WHERE id=$1", [tx.budget_line_id])).rows[0];
      const consumed = (await client.query("SELECT COALESCE(sum(amount),0)::numeric as total FROM transactions WHERE budget_line_id=$1 AND status IN ('submitted','approved')", [tx.budget_line_id])).rows[0];
      const remaining = Number(budgetLine?.amount || 0) - Number(consumed.total || 0);

      const history = (await client.query("SELECT amount, invoice_number as \"invoiceNumber\", vendor, transaction_date as date FROM transactions WHERE allocation_id=$1", [tx.allocation_id])).rows;
      const violations = evaluateCompliance({ amount: Number(tx.amount), invoiceNumber: tx.invoice_number, vendor: tx.vendor, date: tx.transaction_date }, history, remaining, proofCount > 0);

      for (const rule of violations) {
        await client.query(
          "INSERT INTO rule_violations (tenant_id,transaction_id,rule_code,severity,details) VALUES ($1,$2,$3,$4,$5)",
          [req.auth!.tenantId, tx.id, rule, rule === "over_budget" ? "high" : "medium", { source: "submit-check" }]
        );
      }

      await client.query("UPDATE transactions SET status='submitted' WHERE id=$1", [req.params.id]);
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "transaction.submit", "transaction", req.params.id, { violations });
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/review", requireRole("reviewer", "tenant_admin"), requireIdempotencyKey, async (req: AuthRequest, res, next) => {
  try {
    const { decision, reason } = req.body;
    await withTenant(req.auth!.tenantId, async (client) => {
      await client.query("INSERT INTO approvals (id,tenant_id,transaction_id,reviewer_id,decision,reason) VALUES ($1,$2,$3,$4,$5,$6)", [uuid(), req.auth!.tenantId, req.params.id, req.auth!.userId, decision, reason || null]);
      await client.query("UPDATE transactions SET status=$1 WHERE id=$2", [decision === "approve" ? "approved" : decision === "request_info" ? "needs_info" : "rejected", req.params.id]);
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, `transaction.${decision}`, "transaction", req.params.id, { reason });
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});


router.get("/attachments/:attachmentId/download", requireRole("counterparty_user", "tenant_admin", "reviewer", "auditor"), async (req: AuthRequest, res, next) => {
  try {
    await withTenant(req.auth!.tenantId, async (client) => {
      const att = (await client.query("SELECT * FROM attachments WHERE id=$1", [req.params.attachmentId])).rows[0];
      if (!att) throw new AppError("NOT_FOUND", "Attachment not found", 404);
      await client.query("INSERT INTO download_logs (tenant_id,user_id,file_type,file_ref) VALUES ($1,$2,$3,$4)", [req.auth!.tenantId, req.auth!.userId, "attachment", att.id]);
      await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "attachment.download", "attachment", att.id, {});
      res.setHeader("content-type", att.mime_type);
      res.setHeader("content-disposition", `attachment; filename="${att.original_name}"`);
      res.send(fs.readFileSync(att.storage_path));
    });
  } catch (e) {
    next(e);
  }
});

export default router;
