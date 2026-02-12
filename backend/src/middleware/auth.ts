import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type AuthUser = { userId: string; tenantId: string; roles: string[] };
export type AuthRequest = Request & { auth?: AuthUser };

export const authGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ code: "UNAUTHORIZED", message: "Missing token" });
  try {
    req.auth = jwt.verify(auth.slice(7), env.jwtSecret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "Invalid token" });
  }
};

export const requireRole = (...allowed: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.auth) return res.status(401).json({ code: "UNAUTHORIZED", message: "No auth context" });
  if (!allowed.some((r) => req.auth!.roles.includes(r))) return res.status(403).json({ code: "FORBIDDEN", message: "Insufficient role" });
  next();
};
