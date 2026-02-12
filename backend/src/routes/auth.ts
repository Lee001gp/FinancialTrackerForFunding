import { Router } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { pool } from "../db/pool";
import { env } from "../config/env";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.post("/login", rateLimit(10, 60_000, "login"), async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(8), tenantId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
  const { email, password, tenantId } = parsed.data;

  const result = await pool.query("SELECT id,password_hash,roles,failed_attempts,lock_until FROM users WHERE email=$1 AND tenant_id=$2", [email, tenantId]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Login failed" });
  if (user.lock_until && new Date(user.lock_until).getTime() > Date.now()) {
    return res.status(423).json({ code: "ACCOUNT_LOCKED", message: "Account locked. Try later." });
  }

  const ok = await argon2.verify(user.password_hash, password);
  if (!ok) {
    const attempts = Number(user.failed_attempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await pool.query("UPDATE users SET failed_attempts=$1, lock_until=$2 WHERE id=$3", [attempts, lockUntil, user.id]);
    return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Login failed" });
  }

  await pool.query("UPDATE users SET failed_attempts=0, lock_until=NULL WHERE id=$1", [user.id]);
  const token = jwt.sign({ userId: user.id, tenantId, roles: user.roles }, env.jwtSecret, { expiresIn: "8h" });
  res.json({ token });
});

router.post("/logout", async (_req, res) => {
  res.json({ ok: true });
});

router.post("/password-reset/request", async (req, res) => {
  const parsed = z.object({ email: z.string().email(), tenantId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
  const { email, tenantId } = parsed.data;
  const user = (await pool.query("SELECT id FROM users WHERE email=$1 AND tenant_id=$2", [email, tenantId])).rows[0];
  if (user) {
    const token = crypto.randomBytes(24).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query(
      "INSERT INTO password_reset_tokens (tenant_id,user_id,token_hash,expires_at,used) VALUES ($1,$2,$3,now() + interval '30 minutes',false)",
      [tenantId, user.id, tokenHash]
    );
    return res.json({ ok: true, reset_token_for_local_demo_only: token });
  }
  res.json({ ok: true });
});

router.post("/password-reset/confirm", async (req, res) => {
  const parsed = z.object({ tenantId: z.string().uuid(), token: z.string().min(12), newPassword: z.string().min(8) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });
  const { tenantId, token, newPassword } = parsed.data;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const row = (await pool.query(
    "SELECT id,user_id FROM password_reset_tokens WHERE tenant_id=$1 AND token_hash=$2 AND used=false AND expires_at>now() ORDER BY created_at DESC LIMIT 1",
    [tenantId, tokenHash]
  )).rows[0];
  if (!row) return res.status(400).json({ code: "INVALID_TOKEN", message: "Invalid or expired reset token" });
  const hash = await argon2.hash(newPassword);
  await pool.query("UPDATE users SET password_hash=$1,failed_attempts=0,lock_until=NULL WHERE id=$2", [hash, row.user_id]);
  await pool.query("UPDATE password_reset_tokens SET used=true WHERE id=$1", [row.id]);
  res.json({ ok: true });
});

export default router;
