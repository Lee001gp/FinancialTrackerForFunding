import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";
import { v4 as uuid } from "uuid";

const router = Router();
router.use(authGuard);

router.post("/", requireRole("tenant_admin", "program_manager"), async (req: AuthRequest, res) => {
  const parsed = z.object({ name: z.string(), amount: z.number().positive(), mode: z.string(), counterpartyId: z.string().uuid().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
  const id = uuid();
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query(
      "INSERT INTO allocations (id,tenant_id,name,amount,mode,counterparty_id,status) VALUES ($1,$2,$3,$4,$5,$6,'draft')",
      [id, req.auth!.tenantId, parsed.data.name, parsed.data.amount, parsed.data.mode, parsed.data.counterpartyId || null]
    );
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "allocation.create", "allocation", id, parsed.data);
  });
  res.status(201).json({ id });
});

router.get("/", async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM allocations ORDER BY created_at DESC")).rows);
  res.json(rows);
});

export default router;
