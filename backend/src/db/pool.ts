import { Pool } from "pg";
import { env } from "../config/env";

export const pool = new Pool({ connectionString: env.databaseUrl });

export const withTenant = async <T>(tenantId: string, fn: (client: any) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.tenant_id = $1", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
