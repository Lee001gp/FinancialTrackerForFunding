import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";

const router = Router();
router.use(authGuard);

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

export default router;
