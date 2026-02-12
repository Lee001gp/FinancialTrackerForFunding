import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { v4 as uuid } from "uuid";

const router = Router();
router.use(authGuard);

router.get("/features", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT feature_key, enabled FROM tenant_features ORDER BY feature_key")).rows);
  res.json(rows);
});

router.put("/features", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.array(z.object({ featureKey: z.string(), enabled: z.boolean() })).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    for (const row of payload) {
      await client.query(
        `INSERT INTO tenant_features (tenant_id, feature_key, enabled) VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id, feature_key) DO UPDATE SET enabled=excluded.enabled`,
        [req.auth!.tenantId, row.featureKey, row.enabled]
      );
    }
  });
  res.json({ ok: true });
});

router.get("/terms", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT term_key, label FROM tenant_terms ORDER BY term_key")).rows);
  res.json(rows);
});

router.put("/terms", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.array(z.object({ termKey: z.string(), label: z.string().min(1) })).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    for (const row of payload) {
      await client.query(
        `INSERT INTO tenant_terms (tenant_id, term_key, label) VALUES ($1,$2,$3)
         ON CONFLICT (tenant_id, term_key) DO UPDATE SET label=excluded.label`,
        [req.auth!.tenantId, row.termKey, row.label]
      );
    }
  });
  res.json({ ok: true });
});

router.get("/categories", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM category_libraries ORDER BY created_at DESC")).rows);
  res.json(rows);
});

router.post("/categories", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ name: z.string().min(1), code: z.string().min(1), kind: z.string().default("expense") }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query(
      `INSERT INTO category_libraries (id, tenant_id, name, code, kind)
       VALUES ($1,$2,$3,$4,$5)`,
      [uuid(), req.auth!.tenantId, payload.name, payload.code, payload.kind]
    );
  });
  res.status(201).json({ ok: true });
});

router.get("/workflows", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT id,name,definition FROM workflow_templates ORDER BY name")).rows);
  res.json(rows);
});

router.post("/workflows", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ name: z.string().min(1), definition: z.any() }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO workflow_templates (id,tenant_id,name,definition) VALUES ($1,$2,$3,$4)", [uuid(), req.auth!.tenantId, payload.name, payload.definition || {}]);
  });
  res.status(201).json({ ok: true });
});

router.get("/custom-fields", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM custom_fields ORDER BY entity_type, field_key")).rows);
  res.json(rows);
});

router.post("/custom-fields", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ entityType: z.string(), fieldKey: z.string(), label: z.string(), fieldType: z.string(), required: z.boolean().optional(), config: z.any().optional() }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query(
      `INSERT INTO custom_fields (id,tenant_id,entity_type,field_key,label,field_type,required,config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [uuid(), req.auth!.tenantId, payload.entityType, payload.fieldKey, payload.label, payload.fieldType, payload.required || false, payload.config || {}]
    );
  });
  res.status(201).json({ ok: true });
});



router.get("/templates", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const rows = await withTenant(req.auth!.tenantId, async (client) => (await client.query("SELECT * FROM tenant_templates ORDER BY created_at DESC")).rows);
  res.json(rows);
});

router.post("/templates", requireRole("tenant_admin"), async (req: AuthRequest, res) => {
  const payload = z.object({ templateName: z.string().min(2), config: z.any().optional() }).parse(req.body);
  await withTenant(req.auth!.tenantId, async (client) => {
    await client.query("INSERT INTO tenant_templates (id,tenant_id,template_name,config) VALUES ($1,$2,$3,$4)", [uuid(), req.auth!.tenantId, payload.templateName, payload.config || {}]);
  });
  res.status(201).json({ ok: true });
});

export default router;
