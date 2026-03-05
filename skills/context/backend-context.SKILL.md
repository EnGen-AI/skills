---
name: backend-context
version: 1.0.0
description: |
  EnGenAI backend conventions — FastAPI patterns, service layer, async DB
  access, authentication, middleware, and security patterns. Reference for
  Sophi and any agent working in src/backend/.

engenai:
  category: context
  trust_tier: official
  risk_level: low
  capabilities_required: []
  allowed_domains: []
  content_hash: ""
  signed_by: ""
  last_reviewed: ""
  reviewer: ""

author: engenai
license: Apache-2.0
updated: 2026-03-05
tags: [context, backend, fastapi, python, database]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Backend Context

## FastAPI App Structure

```
src/backend/
├── app/
│   ├── main.py              — App entry point, lifespan, middleware
│   ├── config.py            — Pydantic Settings (env-loaded)
│   ├── database.py          — Async engine, session, get_db(), RLS activation
│   ├── api/v1/router.py     — All v1 routers aggregated here
│   ├── api/v1/endpoints/    — One file per resource (agents.py, skills.py, etc.)
│   ├── models/              — SQLAlchemy ORM models
│   ├── schemas/             — Pydantic request/response schemas
│   ├── services/            — Business logic (agent_executor, skill_registry, etc.)
│   ├── core/                — Auth, rate limiter, middleware
│   ├── security/            — kill_switch, skill_sanitiser, output_validator,
│   │                          tenant_context, redis_tenant
│   └── middleware/          — TenantContextMiddleware
├── alembic/                 — DB migrations
└── tests/                   — Pytest (async)
```

## Key Patterns

### Endpoint Pattern

```python
@router.get("/{id}", response_model=SchemaOut)
async def get_resource(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SchemaOut:
    resource = await service.get_by_id(db, id, org_id=current_user.org_id)
    if not resource:
        raise HTTPException(status_code=404)
    return SchemaOut.model_validate(resource)
```

### Service Layer Pattern

```python
# Services receive db session + org_id — never access request context
async def get_by_id(db: AsyncSession, id: UUID, org_id: UUID) -> Model | None:
    result = await db.execute(
        select(Model).where(Model.id == id, Model.org_id == org_id)
    )
    return result.scalar_one_or_none()
```

### DB Session (get_db)

- `get_db()` in `database.py` activates PostgreSQL RLS for every request
- `SET LOCAL app.current_org_id` is issued if org context is set
- Auto-commits on success, auto-rollbacks on exception
- RLS policies enforce org isolation at the DB level

### Authentication Flow

1. `get_current_user()` in `core/auth_middleware.py` — verifies JWT
2. Immediately calls `set_org_context(user.org_id)` (tenant_context.py)
3. `get_db()` reads org context → issues `SET LOCAL` to activate RLS

### Security Checks (Sprint 22)

All agent execution paths must call, in order:

```python
# 1. Kill switch — before any skill loading
ks_killed, reason = await kill_switch.check_all(
    agent_id=agent_id, org_id=org_id
)
if ks_killed:
    raise RuntimeError(f"Agent halted: {reason}")

# 2. Sanitise skill content before injection
safe_content = sanitise_skill_content(raw_content)

# 3. Validate LLM output before delivery
validation = validate_output(response_text)
if validation.blocked:
    raise RuntimeError(f"Output blocked: {validation.reason}")
```

## Migrations (Alembic)

```bash
# Create new migration
cd src/backend && alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Naming: NNN_description.py (sequential, zero-padded)
# Current head: 026_skill_immutability_trigger
```

## Error Handling

- 404: Resource not found (never 403 for existence — leaks info)
- 422: Validation error (Pydantic handles automatically)
- 429: Rate limit exceeded (slowapi handles automatically)
- 500: Internal — log the exception, return generic message

## Environment Config (app/config.py)

All config is loaded from environment via Pydantic `BaseSettings`.
Never hardcode secrets. Never read `os.environ` directly — always use `settings.*`.

Key settings: `DATABASE_URL`, `REDIS_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `APP_NAME`, `APP_VERSION`.
