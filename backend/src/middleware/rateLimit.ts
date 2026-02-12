import { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const hit = (key: string, limit: number, windowMs: number) => {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  existing.count += 1;
  buckets.set(key, existing);
  return { ok: existing.count <= limit, remaining: Math.max(0, limit - existing.count) };
};

export const rateLimit = (limit: number, windowMs: number, scope: string) => (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `${scope}:${ip}`;
  const result = hit(key, limit, windowMs);
  res.setHeader("x-ratelimit-remaining", String(result.remaining));
  if (!result.ok) return res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests" });
  next();
};
