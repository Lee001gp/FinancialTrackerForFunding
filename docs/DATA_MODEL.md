# DATA MODEL

Primary relationships:
- tenant -> users/counterparties/allocations/budgets/transactions/attachments/approvals/reports/rule_violations/audit tables
- allocation -> budgets -> budget_lines
- allocation + budget_line -> transactions
- transaction -> attachments + approvals

RLS enforced on all tenant-scoped operational tables.
