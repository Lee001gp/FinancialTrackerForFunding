import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth";
import { withTenant } from "../db/pool";
import { AppError } from "./errors";

export const requireIdempotencyKey = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const key = req.headers["idempotency-key"] as string | undefined;
  if (!key) return next(new AppError("IDEMPOTENCY_KEY_REQUIRED", "idempotency-key header is required", 400));

  await withTenant(req.auth!.tenantId, async (client) => {
    const existing = await client.query(
      "SELECT id FROM idempotency_keys WHERE tenant_id=$1 AND actor_id=$2 AND idempotency_key=$3",
      [req.auth!.tenantId, req.auth!.userId, key]
    );
    if (existing.rowCount && req.method !== "GET") throw new AppError("DUPLICATE_REQUEST", "Duplicate idempotent request", 409);
    await client.query(
      `INSERT INTO idempotency_keys (tenant_id, actor_id, idempotency_key, method, route)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [req.auth!.tenantId, req.auth!.userId, key, req.method, req.path]
    );
  });

  next();
};
