const { Client } = require('pg');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/allocations';

async function handleJob(client, job) {
  switch (job.type) {
    case 'send_deadline_reminders':
      console.log('reminders for tenant', job.tenant_id);
      break;
    case 'escalate_overdue_items':
      await client.query("INSERT INTO escalations (tenant_id, reason, status) VALUES ($1,$2,'open')", [job.tenant_id, 'Automated overdue escalation']);
      break;
    case 'generate_scheduled_report':
      await client.query("INSERT INTO reports (id, tenant_id, name, status, generated_by, metadata) VALUES (gen_random_uuid(),$1,$2,'ready',$3,$4)", [job.tenant_id, 'Scheduled Report', job.payload?.generated_by || null, job.payload || {}]);
      break;
    case 'recalculate_risk_scores':
      await client.query("INSERT INTO risk_scores (tenant_id, score) VALUES ($1,$2)", [job.tenant_id, Number(job.payload?.score || 50)]);
      break;
    case 'verify_audit_chain':
      console.log('audit chain verification queued for tenant', job.tenant_id);
      break;
    default:
      console.log('unknown job type', job.type);
  }
}

async function tick() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const { rows } = await client.query("UPDATE jobs SET status='running', attempts=attempts+1 WHERE id IN (SELECT id FROM jobs WHERE status='queued' AND run_at <= now() ORDER BY run_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *");
  for (const job of rows) {
    try {
      await handleJob(client, job);
      await client.query("UPDATE jobs SET status='done' WHERE id=$1", [job.id]);
    } catch (e) {
      console.error('job failed', job.id, e.message);
      await client.query("UPDATE jobs SET status='failed' WHERE id=$1", [job.id]);
    }
  }
  await client.end();
}
setInterval(() => tick().catch(console.error), 5000);
