import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";

const router = Router();
router.use(authGuard);
router.use(requireRole("tenant_admin"));

router.get("/", async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT id,email,roles,created_at FROM users ORDER BY created_at DESC")).rows);
  res.json(rows);
});

router.post("/", async (req: AuthRequest, res) => {
  const payload = z.object({ email: z.string().email(), password: z.string().min(8), roles: z.array(z.string()).min(1) }).parse(req.body);
  const id = uuid();
  const passwordHash = await argon2.hash(payload.password);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO users (id,tenant_id,email,password_hash,roles) VALUES ($1,$2,$3,$4,$5)", [id, req.auth!.tenantId, payload.email, passwordHash, payload.roles]);
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "user.create", "user", id, { email: payload.email, roles: payload.roles });
  });
  res.status(201).json({ id });
});

export default router;
