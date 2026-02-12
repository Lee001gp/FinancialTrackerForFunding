import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { v4 as uuid } from "uuid";

const router = Router();
router.use(authGuard);

router.get("/violations", requireRole("reviewer", "tenant_admin", "auditor"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM rule_violations ORDER BY created_at DESC LIMIT 500")).rows);
  res.json(rows);
});

router.get("/cases", requireRole("reviewer", "tenant_admin", "auditor"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM cases ORDER BY created_at DESC LIMIT 200")).rows);
  res.json(rows);
});

router.post("/cases", requireRole("reviewer", "tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ title: z.string().min(2), source: z.string().optional() }).parse(req.body);
  const id = uuid();
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO cases (id,tenant_id,title,status,source) VALUES ($1,$2,$3,'open',$4)", [id, req.auth!.tenantId, payload.title, payload.source || null]);
    await client.query("INSERT INTO case_events (tenant_id,case_id,actor_id,event_type,payload) VALUES ($1,$2,$3,$4,$5)", [req.auth!.tenantId, id, req.auth!.userId, "case.created", payload]);
  });
  res.status(201).json({ id });
});

router.patch("/cases/:id", requireRole("reviewer", "tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ status: z.enum(["open", "investigating", "closed"]) }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("UPDATE cases SET status=$1 WHERE id=$2", [payload.status, req.params.id]);
    await client.query("INSERT INTO case_events (tenant_id,case_id,actor_id,event_type,payload) VALUES ($1,$2,$3,$4,$5)", [req.auth!.tenantId, req.params.id, req.auth!.userId, "case.status_changed", payload]);
  });
  res.json({ ok: true });
});

router.get("/cases/:id/events", requireRole("reviewer", "tenant_admin", "auditor"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM case_events WHERE case_id=$1 ORDER BY created_at DESC", [req.params.id])).rows);
  res.json(rows);
});

export default router;
