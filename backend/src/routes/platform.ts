import { Router } from "express";
import argon2 from "argon2";
import { pool } from "../db/pool";
import { authGuard, requireRole } from "../middleware/auth";

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

export default router;
