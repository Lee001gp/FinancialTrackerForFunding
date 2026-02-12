import { Router } from "express";
import { z } from "zod";
import { authGuard, AuthRequest, requireRole } from "../middleware/auth";
import { withTenant } from "../db/pool";
import { appendAudit } from "../services/audit";
import { v4 as uuid } from "uuid";

const router = Router();
router.use(authGuard);

router.post("/", requireRole("counterparty_user", "tenant_admin"), async (req: AuthRequest, res) => {
  const parsed = z.object({ allocationId: z.string().uuid(), lines: z.array(z.object({ category: z.string(), amount: z.number().positive() })).min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payload", details: parsed.error.flatten() });

  await withTenant(req.auth!.tenantId, async (client) => {
    const allocation = (await client.query("SELECT amount FROM allocations WHERE id=$1", [parsed.data.allocationId])).rows[0];
    if (!allocation) throw new Error("Allocation not found");
    const total = parsed.data.lines.reduce((a, l) => a + l.amount, 0);
    if (Number(allocation.amount) !== total) throw new Error("Budget total must match allocation amount");

    const budgetId = uuid();
    await client.query("INSERT INTO budgets (id,tenant_id,allocation_id,version,status,created_by) VALUES ($1,$2,$3,1,'submitted',$4)", [budgetId, req.auth!.tenantId, parsed.data.allocationId, req.auth!.userId]);
    for (const line of parsed.data.lines) {
      await client.query("INSERT INTO budget_lines (id,tenant_id,budget_id,category,amount) VALUES ($1,$2,$3,$4,$5)", [uuid(), req.auth!.tenantId, budgetId, line.category, line.amount]);
    }
    await appendAudit(client, req.auth!.tenantId, req.auth!.userId, "budget.submit", "budget", budgetId, parsed.data);
  });
  res.status(201).json({ ok: true });
});

export default router;
