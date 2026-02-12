import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const correlationMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  (req as any).correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  next();
};

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: `Route not found: ${req.method} ${req.path}`,
    details: null,
    correlation_id: (req as any).correlationId,
  });
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details || null,
      correlation_id: (req as any).correlationId,
    });
  }
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: err.message || "Unexpected server error",
    details: null,
    correlation_id: (req as any).correlationId,
  });
};
