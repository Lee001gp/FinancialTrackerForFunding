import { pool } from "../db/pool";
import argon2 from "argon2";
import { v4 as uuid } from "uuid";

(async () => {
  const tenants = [
    { id: uuid(), name: "Dept of Sport", template: "Government Grants Template" },
    { id: uuid(), name: "Dept of Agriculture", template: "Government Grants Template" },
    { id: uuid(), name: "Acme Holdings", template: "Internal Budget + Procurement Template" },
  ];

  for (const t of tenants) {
    await pool.query("INSERT INTO tenants (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING", [t.id, t.name]);
    await pool.query("INSERT INTO tenant_templates (tenant_id, template_name, config) VALUES ($1,$2,$3)", [t.id, t.template, {}]);
  }

  const passwordHash = await argon2.hash("Passw0rd!");
  await pool.query("INSERT INTO platform_users (email,password_hash,roles) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING", ["platformadmin@local.test", passwordHash, ["platform_admin"]]);
  const usersByTenant: Record<string, string> = {};

  for (const t of tenants) {
    const userId = uuid();
    usersByTenant[t.id] = userId;
    await pool.query(
      "INSERT INTO users (id,tenant_id,email,password_hash,roles) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [userId, t.id, `admin+${t.name.toLowerCase().replace(/\s/g, "")}@local.test`, passwordHash, ["tenant_admin", "reviewer", "auditor", "counterparty_user"]]
    );
  }

  const sportTenant = tenants[0].id;
  const agriTenant = tenants[1].id;
  const acmeTenant = tenants[2].id;

  const lions = uuid();
  const greenHarvest = uuid();
  const brightBuild = uuid();

  await pool.query("INSERT INTO counterparties (id, tenant_id, name, type) VALUES ($1,$2,$3,$4)", [lions, sportTenant, "Lions FC", "sports club"]);
  await pool.query("INSERT INTO counterparties (id, tenant_id, name, type) VALUES ($1,$2,$3,$4)", [greenHarvest, agriTenant, "GreenHarvest Co-op", "agri co-op"]);
  await pool.query("INSERT INTO counterparties (id, tenant_id, name, type) VALUES ($1,$2,$3,$4)", [brightBuild, acmeTenant, "BrightBuild Subcontractors", "construction vendor"]);

  const sportAllocation = uuid();
  const agriAllocation = uuid();
  const acmeAllocation = uuid();

  await pool.query("INSERT INTO allocations (id,tenant_id,name,amount,mode,counterparty_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)", [sportAllocation, sportTenant, "Sport Allocation 2026", 1000000, "external_funding", lions, "active"]);
  await pool.query("INSERT INTO allocations (id,tenant_id,name,amount,mode,counterparty_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)", [agriAllocation, agriTenant, "Agri Inputs & Training", 750000, "external_funding", greenHarvest, "active"]);
  await pool.query("INSERT INTO allocations (id,tenant_id,name,amount,mode,counterparty_id,status) VALUES ($1,$2,$3,$4,$5,$6,$7)", [acmeAllocation, acmeTenant, "Corporate Procurement FY26", 500000, "procurement", brightBuild, "active"]);

  for (const [tenantId, allocationId, amount, userId] of [
    [sportTenant, sportAllocation, 1000000, usersByTenant[sportTenant]],
    [agriTenant, agriAllocation, 750000, usersByTenant[agriTenant]],
    [acmeTenant, acmeAllocation, 500000, usersByTenant[acmeTenant]],
  ] as [string, string, number, string][]) {
    const budgetId = uuid();
    await pool.query("INSERT INTO budgets (id,tenant_id,allocation_id,version,status,created_by) VALUES ($1,$2,$3,1,'approved',$4)", [budgetId, tenantId, allocationId, userId]);
    await pool.query("INSERT INTO budget_lines (id,tenant_id,budget_id,category,amount) VALUES ($1,$2,$3,$4,$5)", [uuid(), tenantId, budgetId, "Operations", amount * 0.6]);
    await pool.query("INSERT INTO budget_lines (id,tenant_id,budget_id,category,amount) VALUES ($1,$2,$3,$4,$5)", [uuid(), tenantId, budgetId, "Training", amount * 0.4]);
  }

  console.log("seed complete with demo tenants, counterparties, allocations, and approved budgets");
  await pool.end();
})();
