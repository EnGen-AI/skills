---
name: api-design
version: 1.0.0
description: |
  FastAPI REST API design patterns for EnGenAI: versioning, error handling,
  request/response schemas, authentication integration, pagination,
  and OpenAPI documentation conventions.

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

# API Design Patterns

## URL Conventions

```
/api/v1/{resource}              ← collection
/api/v1/{resource}/{id}         ← single item (UUID)
/api/v1/{resource}/{id}/{sub}   ← sub-resource

Examples:
  GET  /api/v1/agents
  POST /api/v1/agents
  GET  /api/v1/agents/{agent_id}
  GET  /api/v1/agents/{agent_id}/skills
  POST /api/v1/skills/{skill_id}/bind
```

**Rules:**
- Plural nouns for collections
- UUIDs for all resource identifiers (never sequential integers)
- Use HTTP verbs correctly — no `/get-skill` or `/do-approve`
- Admin routes under `/api/v1/admin/` (require `is_provider_admin`)

## Request/Response Schemas (Pydantic v2)

```python
# Request
class CreateAgentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=1000)
    org_id: uuid.UUID  # validated against current_user.org_id in endpoint

# Response — always explicit, never return ORM model directly
class AgentResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    org_id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Pagination
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
    has_next: bool
```

## Error Handling

```python
# Standard error shape — ALWAYS use this
from fastapi import HTTPException

raise HTTPException(
    status_code=404,
    detail={
        "error": "agent_not_found",
        "message": "Agent not found",
        # Do NOT leak: org_id, internal IDs, stack traces
    }
)

# Status codes:
# 400 — Bad request (validation, invalid input)
# 401 — Unauthenticated (missing/invalid token)
# 403 — Forbidden (valid user, wrong permissions)
# 404 — Not found (also use for "forbidden but hide existence")
# 409 — Conflict (duplicate resource)
# 422 — Unprocessable entity (Pydantic validation failure — FastAPI auto)
# 500 — Internal server error (never leak details)
```

## Authentication Pattern

```python
from app.api.deps import get_current_user

@router.get("/agents/{agent_id}")
async def get_agent(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # always inject
) -> AgentResponse:
    # ALWAYS validate org ownership
    agent = await db.get(Agent, agent_id)
    if not agent or agent.org_id != current_user.org_id:
        raise HTTPException(status_code=404, detail={"error": "agent_not_found"})
    return AgentResponse.model_validate(agent)
```

## Dependency Injection

```python
# Database session — always async
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

# Prefer explicit dependencies over global state
# Each endpoint declares what it needs — no hidden globals
```

## Pagination

```python
@router.get("/agents")
async def list_agents(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[AgentResponse]:
    offset = (page - 1) * per_page
    total = await db.scalar(
        select(func.count()).where(Agent.org_id == current_user.org_id)
    )
    result = await db.execute(
        select(Agent)
        .where(Agent.org_id == current_user.org_id)
        .offset(offset).limit(per_page)
    )
    items = [AgentResponse.model_validate(a) for a in result.scalars()]
    return PaginatedResponse(
        items=items, total=total, page=page,
        per_page=per_page, has_next=(offset + per_page) < total,
    )
```

## OpenAPI Documentation

```python
@router.post(
    "/agents",
    response_model=AgentResponse,
    status_code=201,
    summary="Create a new agent",
    description="Creates an agent for the current user's organisation.",
    responses={
        201: {"description": "Agent created successfully"},
        400: {"description": "Invalid request body"},
        401: {"description": "Authentication required"},
    },
)
```

## Router Organisation

```python
# src/backend/app/api/v1/agents.py
router = APIRouter(prefix="/agents", tags=["agents"])

# src/backend/app/api/v1/__init__.py
from .agents import router as agents_router
api_router.include_router(agents_router)
```

## Anti-Patterns to Avoid

- Returning ORM models directly (use Pydantic response models)
- Leaking internal IDs, org_id, or stack traces in errors
- Business logic in endpoint functions — put it in services
- Mutable default arguments in Pydantic models
- `db.execute()` with raw SQL strings (always use ORM or `text()` with params)
