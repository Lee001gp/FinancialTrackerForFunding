import { Router } from "express";
import argon2 from "argon2";
import fs from "fs";
import path from "path";
import { pool } from "../db/pool";
import { authGuard, requireRole } from "../middleware/auth";
import { env } from "../config/env";

const router = Router();
router.use(authGuard);
router.use(requireRole("platform_admin"));

router.get("/tenants", async (_req, res) => {
  const rows = (await pool.query("SELECT id, name, created_at FROM tenants ORDER BY created_at DESC")).rows;
  res.json(rows);
});

router.post("/tenants", async (req, res) => {
  const { id, name } = req.body;
  await pool.query("INSERT INTO tenants (id,name) VALUES ($1,$2)", [id, name]);
  res.status(201).json({ ok: true });
});

router.get("/users", async (_req, res) => {
  const rows = (await pool.query("SELECT id, email, roles, created_at FROM platform_users ORDER BY created_at DESC")).rows;
  res.json(rows);
});

router.post("/users", async (req, res) => {
  const { email, password, roles } = req.body;
  const passwordHash = await argon2.hash(password || "Passw0rd!");
  await pool.query("INSERT INTO platform_users (email,password_hash,roles) VALUES ($1,$2,$3)", [email, passwordHash, roles || ["platform_admin"]]);
  res.status(201).json({ ok: true });
});

router.get("/health", async (_req, res) => {
  const dbPing = await pool.query("SELECT now() as now");
  const queue = await pool.query("SELECT status, count(*)::int as c FROM jobs GROUP BY status ORDER BY status");
  const uploadsPath = env.uploadsPath;
  let uploadsBytes = 0;
  try {
    const files = fs.readdirSync(uploadsPath);
    for (const f of files) {
      const stat = fs.statSync(path.join(uploadsPath, f));
      if (stat.isFile()) uploadsBytes += stat.size;
    }
  } catch {
    uploadsBytes = 0;
  }
  res.json({
    db: { ok: true, now: dbPing.rows[0].now },
    queue: queue.rows,
    uploads: { path: uploadsPath, bytes: uploadsBytes },
  });
});

router.get("/audit", async (req, res) => {
  const limit = Number(req.query.limit || 200);
  const rows = (
    await pool.query(
      `SELECT tenant_id, actor_id, action, entity_type, entity_id, created_at
       FROM audit_log_events ORDER BY created_at DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 2000)]
    )
  ).rows;
  res.json(rows);
});

router.get("/settings", async (_req, res) => {
  const rows = (await pool.query("SELECT setting_key, setting_value, updated_at FROM platform_settings ORDER BY setting_key")).rows;
  res.json(rows);
});

router.put("/settings", async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  for (const item of items) {
    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
       VALUES ($1,$2,now())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_at=now()`,
      [item.settingKey, item.settingValue || {}]
    );
  }
  res.json({ ok: true });
});

export default router;
