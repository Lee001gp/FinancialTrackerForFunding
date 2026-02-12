import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../config/env";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";

const router = Router();
router.use(authGuard);
fs.mkdirSync(env.uploadsPath, { recursive: true });
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", requireRole("tenant_admin", "reviewer", "counterparty_user"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM counterparties ORDER BY created_at DESC")).rows);
  res.json(rows);
});

router.post("/", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ name: z.string().min(2), type: z.string().default("organization") }).parse(req.body);
  const id = uuid();
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO counterparties (id,tenant_id,name,type) VALUES ($1,$2,$3,$4)", [id, req.auth!.tenantId, payload.name, payload.type]);
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "counterparty.create", "counterparty", id, payload);
  });
  res.status(201).json({ id });
});

router.post("/:id/profile", requireRole("tenant_admin", "counterparty_user"), async (req: AuthRequest, res) => {
  const payload = z.object({ registrationNumber: z.string().optional(), taxNumber: z.string().optional(), address: z.string().optional() }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query(
      `INSERT INTO counterparty_profiles (id,tenant_id,counterparty_id,registration_number,tax_number,address)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), req.auth!.tenantId, req.params.id, payload.registrationNumber || null, payload.taxNumber || null, payload.address || null]
    );
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "counterparty.profile.create", "counterparty", req.params.id, payload);
  });
  res.status(201).json({ ok: true });
});

router.post("/:id/bank-accounts", requireRole("tenant_admin", "counterparty_user"), async (req: AuthRequest, res) => {
  const payload = z.object({ accountName: z.string(), accountNumberLast4: z.string().min(4).max(4), bankName: z.string() }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    const v = (await client.query("SELECT COALESCE(max(version),0)+1 as v FROM bank_accounts WHERE counterparty_id=$1", [req.params.id])).rows[0].v;
    await client.query(
      `INSERT INTO bank_accounts (id,tenant_id,counterparty_id,account_name,account_number_last4,bank_name,version,verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
      [uuid(), req.auth!.tenantId, req.params.id, payload.accountName, payload.accountNumberLast4, payload.bankName, v]
    );
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "counterparty.bank_account.create", "counterparty", req.params.id, payload);
  });
  res.status(201).json({ ok: true });
});



router.post("/:id/documents", requireRole("tenant_admin", "counterparty_user"), upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ code: "FILE_REQUIRED", message: "Upload required" });
  const sanitized = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filepath = path.join(env.uploadsPath, sanitized);
  fs.writeFileSync(filepath, req.file.buffer);
  const sha = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query(
      `INSERT INTO counterparty_documents (id,tenant_id,counterparty_id,doc_type,storage_path,sha256)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uuid(), req.auth!.tenantId, req.params.id, req.body.docType || "compliance", filepath, sha]
    );
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "counterparty.document.upload", "counterparty", req.params.id, { docType: req.body.docType || "compliance" });
  });
  res.status(201).json({ ok: true, sha256: sha });
});

router.get("/:id/documents", requireRole("tenant_admin", "reviewer", "auditor", "counterparty_user"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT id,doc_type,storage_path,sha256,created_at FROM counterparty_documents WHERE counterparty_id=$1 ORDER BY created_at DESC", [req.params.id])).rows);
  res.json(rows);
});

export default router;
