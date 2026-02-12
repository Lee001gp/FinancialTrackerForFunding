import { Router } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";

const router = Router();
router.use(authGuard);

router.get("/", async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM programs ORDER BY created_at DESC")).rows);
  res.json(rows);
});

router.post("/", requireRole("tenant_admin", "program_manager"), async (req: AuthRequest, res) => {
  const payload = z.object({ name: z.string().min(2) }).parse(req.body);
  const id = uuid();
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO programs (id,tenant_id,name) VALUES ($1,$2,$3)", [id, req.auth!.tenantId, payload.name]);
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "program.create", "program", id, payload);
  });
  res.status(201).json({ id });
});

export default router;
