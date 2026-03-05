---
name: database-migration
version: 1.0.0
description: |
  Alembic database migration patterns for EnGenAI: naming conventions,
  safe migration practices, rollback requirements, data migrations,
  and PostgreSQL-specific patterns (RLS, triggers, JSONB).

engenai:
  category: development
  trust_tier: official
  risk_level: low
  capabilities_required: []
  allowed_domains: []
  content_hash: ""
  signed_by: ""

author: engenai
license: Apache-2.0
updated: "2026-03-05"
tags: 
safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Database Migration Patterns

## File Naming Convention

```
src/backend/alembic/versions/
  001_initial_schema.py
  002_add_agents.py
  ...
  027_skills_marketplace_schema.py   ← zero-padded 3-digit prefix
```

**Revision chain:**
```python
revision = "027_skills_marketplace_schema"
down_revision = "026_skill_immutability_trigger"  # always set explicitly
branch_labels = None
depends_on = None
```

## Migration File Template

```python
"""Purpose of this migration — Sprint XX Phase Y.Z.

Adds:
  - table_name: purpose
  - column_name: what it stores
"""
from __future__ import annotations
import sqlalchemy as sa
from alembic import op

revision = "0NN_description"
down_revision = "0NN-1_previous"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Always write upgrade() AND downgrade()
    pass


def downgrade() -> None:
    # Must be reversible — drop in reverse order of creation
    pass
```

## Safe Column Additions

```python
# SAFE: Adding nullable column (no table lock on large tables)
op.add_column("agents", sa.Column("description", sa.Text, nullable=True))

# SAFE: Adding NOT NULL with server_default (backfills existing rows)
op.add_column(
    "skills",
    sa.Column(
        "trust_tier",
        sa.String(50),
        nullable=False,
        server_default="community_vetted",
    ),
)

# UNSAFE (avoid on tables > 1M rows in production):
# op.alter_column() with nullable=False without server_default
# Use: add nullable → backfill → add constraint as separate step
```

## Data Migrations

```python
def upgrade() -> None:
    # Schema first
    op.add_column("skills", sa.Column("source", sa.String(50), nullable=True))

    # Data migration — use sa.text() with parameters, never f-strings
    op.execute(sa.text(
        "UPDATE skills SET source = 'marketplace' WHERE source = 'clawhub'"
    ))
    op.execute(sa.text(
        "UPDATE skills SET trust_tier = 'official', is_platform_skill = TRUE "
        "WHERE source = 'builtin'"
    ))
```

## PostgreSQL-Specific Patterns

### Row-Level Security

```python
def upgrade() -> None:
    op.execute(sa.text("ALTER TABLE agents ENABLE ROW LEVEL SECURITY"))
    op.execute(sa.text("ALTER TABLE agents FORCE ROW LEVEL SECURITY"))
    op.execute(sa.text(
        "CREATE POLICY agents_own_org ON agents AS PERMISSIVE FOR ALL "
        "USING (org_id = current_setting('app.current_org_id')::uuid)"
    ))

def downgrade() -> None:
    op.execute(sa.text("DROP POLICY IF EXISTS agents_own_org ON agents"))
    op.execute(sa.text("ALTER TABLE agents DISABLE ROW LEVEL SECURITY"))
```

### INSERT-Only Tables (Audit Logs)

```python
op.execute(sa.text("ALTER TABLE skill_audit_log ENABLE ROW LEVEL SECURITY"))
op.execute(sa.text(
    "CREATE POLICY skill_audit_log_insert_only ON skill_audit_log "
    "FOR INSERT TO PUBLIC WITH CHECK (true)"
))
op.execute(sa.text("REVOKE UPDATE, DELETE ON skill_audit_log FROM PUBLIC"))
```

### Immutability Triggers

```python
op.execute(sa.text("""
    CREATE OR REPLACE FUNCTION reset_approval_on_content_change()
    RETURNS TRIGGER AS $$
    BEGIN
        IF OLD.content IS DISTINCT FROM NEW.content THEN
            NEW.approval_status = 'content_modified_pending_review';
            INSERT INTO skill_audit_log (event_type, severity, skill_id, details)
            VALUES (
                'skill_content_modified',
                'HIGH',
                NEW.id,
                jsonb_build_object(
                    'old_hash', encode(sha256(OLD.content::bytea), 'hex'),
                    'new_hash', encode(sha256(NEW.content::bytea), 'hex')
                )
            );
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
"""))
op.execute(sa.text(
    "CREATE TRIGGER skill_content_immutability "
    "BEFORE UPDATE ON skills "
    "FOR EACH ROW EXECUTE FUNCTION reset_approval_on_content_change()"
))
```

### JSONB Columns

```python
op.add_column("agents", sa.Column(
    "config",
    sa.dialects.postgresql.JSONB,
    nullable=False,
    server_default=sa.text("'{}'::jsonb"),
))
```

## Index Strategy

```python
# Always index FK columns and high-cardinality filter columns
op.create_index("ix_skills_trust_tier", "skills", ["trust_tier"])
op.create_index("ix_skills_org_id", "skills", ["org_id"])
op.create_index("ix_agents_org_id", "agents", ["org_id"])

# Composite index for common query pattern
op.create_index("ix_executions_org_created", "agent_executions",
                ["org_id", "created_at"])

# Partial index (PostgreSQL)
op.execute(sa.text(
    "CREATE INDEX ix_skills_active ON skills (org_id) WHERE is_active = TRUE"
))
```

## Running Migrations

```bash
# Generate (review carefully before using)
alembic revision --autogenerate -m "description"

# Apply
alembic upgrade head

# Rollback one step
alembic downgrade -1

# Check current revision
alembic current

# Show migration history
alembic history --verbose
```

## Anti-Patterns to Avoid

- Renaming columns without backward-compat alias (breaks running pods during deploy)
- `DROP COLUMN` without confirming zero references in codebase
- Long-running `UPDATE` without batching (locks table in production)
- `NOT NULL` constraint without `server_default` on non-empty table
- No `downgrade()` implementation — every migration must be reversible
