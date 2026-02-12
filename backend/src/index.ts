import express from "express";
import helmet from "helmet";
import cors from "cors";
import authRoutes from "./routes/auth";
import allocationsRoutes from "./routes/allocations";
import budgetRoutes from "./routes/budgets";
import txRoutes from "./routes/transactions";
import reportRoutes from "./routes/reports";
import auditRoutes from "./routes/audit";
import tenantConfigRoutes from "./routes/tenantConfig";
import complianceRoutes from "./routes/compliance";
import platformRoutes from "./routes/platform";
import tenantUsersRoutes from "./routes/tenantUsers";
import counterpartiesRoutes from "./routes/counterparties";
import programsRoutes from "./routes/programs";
import { env } from "./config/env";
import { correlationMiddleware, errorHandler, notFound } from "./middleware/errors";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(correlationMiddleware);

app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/platform", platformRoutes);
app.use("/tenant-config", tenantConfigRoutes);
app.use("/allocations", allocationsRoutes);
app.use("/programs", programsRoutes);
app.use("/counterparties", counterpartiesRoutes);
app.use("/tenant-users", tenantUsersRoutes);
app.use("/budgets", budgetRoutes);
app.use("/transactions", txRoutes);
app.use("/reports", reportRoutes);
app.use("/compliance", complianceRoutes);
app.use("/audit", auditRoutes);
app.get("/openapi.json", (_, res) =>
  res.json({
    openapi: "3.0.0",
    info: { title: "Allocation API", version: "1.1.0" },
    paths: {
      "/auth/login": { post: {} },
      "/platform/users": { get: {}, post: {} },
      "/platform/tenants": { get: {}, post: {} },
      "/platform/health": { get: {} },
      "/platform/audit": { get: {} },
      "/platform/settings": { get: {}, put: {} },
      "/tenant-users": { get: {}, post: {} },
      "/programs": { get: {}, post: {} },
      "/counterparties": { get: {}, post: {} },
      "/counterparties/:id/profile": { post: {} },
      "/counterparties/:id/bank-accounts": { post: {} },
      "/tenant-config/features": { get: {}, put: {} },
      "/tenant-config/terms": { get: {}, put: {} },
      "/tenant-config/categories": { get: {}, post: {} },
      "/tenant-config/workflows": { get: {}, post: {} },
      "/tenant-config/custom-fields": { get: {}, post: {} },
      "/tenant-config/templates": { get: {}, post: {} },
      "/allocations/:id/disbursements": { get: {}, post: {} },
      "/transactions/review-queue": { get: {} },
      "/counterparties/:id/documents": { get: {}, post: {} },
      "/transactions/draft": { post: {} },
      "/transactions/attachments/:attachmentId/download": { get: {} },
      "/transactions/drafts/offline-sync": { post: {} },
      "/reports/exports/transactions.csv": { get: {} },
      "/audit/verify-chain": { get: {} },
      "/compliance/cases": { get: {}, post: {} },
      "/compliance/cases/:id": { patch: {} },
      "/compliance/cases/:id/events": { get: {} },
      "/auth/logout": { post: {} },
      "/auth/password-reset/request": { post: {} },
      "/auth/password-reset/confirm": { post: {} },
    },
  })
);

app.use(notFound);
app.use(errorHandler);
app.listen(env.port, () => console.log(`API running on ${env.port}`));
