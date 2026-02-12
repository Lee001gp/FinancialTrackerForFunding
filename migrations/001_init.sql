CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- System / tenancy
CREATE TABLE IF NOT EXISTS tenants (id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, password_hash text NOT NULL, roles text[] NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log_signatures (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), chain_sequence bigint NOT NULL, signature text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS tenant_domains (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), domain text NOT NULL, verified boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS tenant_branding (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), logo_url text, primary_color text, secondary_color text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS tenant_features (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), feature_key text NOT NULL, enabled boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, feature_key));
CREATE TABLE IF NOT EXISTS tenant_terms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), term_key text NOT NULL, label text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, term_key));
CREATE TABLE IF NOT EXISTS tenant_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), template_name text NOT NULL, config jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text UNIQUE NOT NULL, setting_value jsonb NOT NULL DEFAULT '{}', updated_at timestamptz DEFAULT now());

-- Identity / RBAC
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), email text NOT NULL, password_hash text NOT NULL, roles text[] NOT NULL DEFAULT '{}', lock_until timestamptz, failed_attempts int NOT NULL DEFAULT 0, created_at timestamptz DEFAULT now(), UNIQUE(tenant_id,email));
CREATE TABLE IF NOT EXISTS roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), role_key text NOT NULL, name text NOT NULL, UNIQUE(tenant_id, role_key));
CREATE TABLE IF NOT EXISTS permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), permission_key text UNIQUE NOT NULL, description text);
CREATE TABLE IF NOT EXISTS role_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), role_id uuid NOT NULL REFERENCES roles(id), permission_id uuid NOT NULL REFERENCES permissions(id), UNIQUE(role_id, permission_id));
CREATE TABLE IF NOT EXISTS user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), role_id uuid NOT NULL REFERENCES roles(id), UNIQUE(user_id, role_id));
CREATE TABLE IF NOT EXISTS org_memberships (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), counterparty_id uuid, role_key text NOT NULL);
CREATE TABLE IF NOT EXISTS api_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL, scopes text[] NOT NULL DEFAULT '{}', expires_at timestamptz);

-- Organizations
CREATE TABLE IF NOT EXISTS counterparties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, type text NOT NULL DEFAULT 'organization', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS counterparty_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), counterparty_id uuid NOT NULL REFERENCES counterparties(id), registration_number text, tax_number text, address text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS counterparty_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), counterparty_id uuid NOT NULL REFERENCES counterparties(id), doc_type text NOT NULL, storage_path text NOT NULL, sha256 text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS vendors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), counterparty_id uuid REFERENCES counterparties(id), vendor_type text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS vendor_blacklist (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), vendor_id uuid NOT NULL REFERENCES vendors(id), reason text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), counterparty_id uuid NOT NULL REFERENCES counterparties(id), account_name text NOT NULL, account_number_last4 text NOT NULL, bank_name text NOT NULL, version int NOT NULL DEFAULT 1, verified boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());

-- Programs / allocations
CREATE TABLE IF NOT EXISTS programs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS allocations (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), program_id uuid REFERENCES programs(id), name text NOT NULL, amount numeric(14,2) NOT NULL, mode text NOT NULL, counterparty_id uuid REFERENCES counterparties(id), risk_tier text DEFAULT 'medium', status text NOT NULL, start_date date, end_date date, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS allocation_participants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), counterparty_id uuid NOT NULL REFERENCES counterparties(id), role_key text NOT NULL);
CREATE TABLE IF NOT EXISTS disbursements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), planned_amount numeric(14,2), actual_amount numeric(14,2), due_date date, status text NOT NULL DEFAULT 'planned', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS allocation_status_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), from_status text, to_status text NOT NULL, changed_by uuid, created_at timestamptz DEFAULT now());

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), version int NOT NULL, status text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz DEFAULT now(), UNIQUE(tenant_id,allocation_id,version));
CREATE TABLE IF NOT EXISTS budget_lines (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), budget_id uuid NOT NULL REFERENCES budgets(id), category text NOT NULL, amount numeric(14,2) NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS budget_line_caps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), budget_line_id uuid NOT NULL REFERENCES budget_lines(id), cap_type text NOT NULL, cap_value numeric(14,2) NOT NULL);
CREATE TABLE IF NOT EXISTS budget_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), budget_id uuid NOT NULL REFERENCES budgets(id), approver_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL, comments text, created_at timestamptz DEFAULT now());

-- Transactions / proof
CREATE TABLE IF NOT EXISTS transactions (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), budget_line_id uuid REFERENCES budget_lines(id), amount numeric(14,2) NOT NULL, invoice_number text, description text, vendor text, transaction_date timestamptz DEFAULT now(), payment_method text, status text NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS transaction_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid NOT NULL REFERENCES transactions(id), item text NOT NULL, quantity numeric(14,2), unit_price numeric(14,2), total numeric(14,2));
CREATE TABLE IF NOT EXISTS attachments (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid NOT NULL REFERENCES transactions(id), original_name text NOT NULL, storage_path text NOT NULL, mime_type text NOT NULL, size_bytes int NOT NULL, sha256 text NOT NULL, version int NOT NULL DEFAULT 1, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS attachment_requirements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), category text NOT NULL, required_docs text[] NOT NULL DEFAULT '{}', min_attachments int NOT NULL DEFAULT 1, allowed_types text[] NOT NULL DEFAULT '{}', max_size_bytes int NOT NULL DEFAULT 10485760);
CREATE TABLE IF NOT EXISTS transaction_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid NOT NULL REFERENCES transactions(id), author_id uuid NOT NULL REFERENCES users(id), comment text NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS transaction_rejections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid NOT NULL REFERENCES transactions(id), reason_code text NOT NULL, reason text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS receipts_invoices_index (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), invoice_number text NOT NULL, vendor text, transaction_id uuid NOT NULL REFERENCES transactions(id), created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, invoice_number));

-- Category libraries / custom fields

CREATE TABLE IF NOT EXISTS category_libraries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, code text NOT NULL, kind text NOT NULL DEFAULT 'expense', created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, code));
CREATE TABLE IF NOT EXISTS custom_fields (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), entity_type text NOT NULL, field_key text NOT NULL, label text NOT NULL, field_type text NOT NULL, required boolean NOT NULL DEFAULT false, config jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, entity_type, field_key));
CREATE TABLE IF NOT EXISTS custom_field_values (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), custom_field_id uuid NOT NULL REFERENCES custom_fields(id), entity_id uuid NOT NULL, value jsonb NOT NULL, created_at timestamptz DEFAULT now());

-- Workflows
CREATE TABLE IF NOT EXISTS workflow_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, definition jsonb NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS workflow_instances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), template_id uuid REFERENCES workflow_templates(id), entity_type text NOT NULL, entity_id uuid NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS workflow_steps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), instance_id uuid NOT NULL REFERENCES workflow_instances(id), step_order int NOT NULL, name text NOT NULL, status text NOT NULL);
CREATE TABLE IF NOT EXISTS workflow_step_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), step_id uuid NOT NULL REFERENCES workflow_steps(id), user_id uuid NOT NULL REFERENCES users(id), assigned_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS approvals (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid NOT NULL REFERENCES transactions(id), reviewer_id uuid NOT NULL REFERENCES users(id), decision text NOT NULL, reason text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS sla_timers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), workflow_step_id uuid NOT NULL REFERENCES workflow_steps(id), due_at timestamptz NOT NULL, breached boolean NOT NULL DEFAULT false);

-- Compliance / risk
CREATE TABLE IF NOT EXISTS compliance_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), rule_code text NOT NULL, enabled boolean NOT NULL DEFAULT true, config jsonb NOT NULL DEFAULT '{}', UNIQUE(tenant_id, rule_code));
CREATE TABLE IF NOT EXISTS rule_violations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), transaction_id uuid REFERENCES transactions(id), rule_code text NOT NULL, severity text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS risk_scores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid REFERENCES allocations(id), counterparty_id uuid REFERENCES counterparties(id), score numeric(6,2) NOT NULL DEFAULT 0, calculated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), title text NOT NULL, status text NOT NULL DEFAULT 'open', source text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS case_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), case_id uuid NOT NULL REFERENCES cases(id), actor_id uuid REFERENCES users(id), event_type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS escalations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid REFERENCES allocations(id), reason text NOT NULL, status text NOT NULL DEFAULT 'open', created_at timestamptz DEFAULT now());

-- Reporting / exports / audit packs
CREATE TABLE IF NOT EXISTS reporting_periods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, status text NOT NULL DEFAULT 'open');
CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, status text NOT NULL, generated_by uuid NOT NULL REFERENCES users(id), metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS exports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), export_type text NOT NULL, storage_path text NOT NULL, generated_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_packs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), allocation_id uuid NOT NULL REFERENCES allocations(id), manifest jsonb NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS download_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid REFERENCES users(id), file_type text NOT NULL, file_ref uuid, downloaded_at timestamptz DEFAULT now());

-- Jobs and idempotency
CREATE TABLE IF NOT EXISTS jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants(id), type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', run_at timestamptz NOT NULL, attempts int NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'queued');
CREATE TABLE IF NOT EXISTS password_reset_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL, expires_at timestamptz NOT NULL, used boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS idempotency_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid NOT NULL REFERENCES users(id), idempotency_key text NOT NULL, method text NOT NULL, route text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, actor_id, idempotency_key));

-- Tamper-evident audit model
CREATE TABLE IF NOT EXISTS audit_log_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), actor_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id uuid, payload jsonb NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log_chain (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), event_id uuid NOT NULL REFERENCES audit_log_events(id), sequence bigint NOT NULL, prev_hash text NOT NULL, hash text NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(tenant_id, sequence));

CREATE OR REPLACE FUNCTION tenant_match(tenant uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT tenant::text = current_setting('app.tenant_id', true)
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','roles','role_permissions','user_roles','org_memberships','api_tokens',
    'counterparties','counterparty_profiles','counterparty_documents','vendors','vendor_blacklist','bank_accounts',
    'programs','allocations','allocation_participants','disbursements','allocation_status_history',
    'budgets','budget_lines','budget_line_caps','budget_approvals',
    'transactions','transaction_lines','attachments','attachment_requirements','transaction_comments','transaction_rejections','receipts_invoices_index',
    'category_libraries','custom_fields','custom_field_values','workflow_templates','workflow_instances','workflow_steps','workflow_step_assignments','approvals','sla_timers',
    'compliance_rules','rule_violations','risk_scores','cases','case_events','escalations',
    'reporting_periods','reports','exports','audit_packs','download_logs',
    'jobs','password_reset_tokens','idempotency_keys','audit_log_events','audit_log_chain','audit_log_signatures',
    'tenant_domains','tenant_branding','tenant_features','tenant_terms','tenant_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_match(tenant_id)) WITH CHECK (tenant_match(tenant_id))', t);
  END LOOP;
END $$;
