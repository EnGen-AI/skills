---
name: api-test
version: 1.0.0
description: |
  API testing patterns for EnGenAI: contract testing, integration test
  structure with FastAPI AsyncClient, auth fixtures, DB session mocking,
  and test organisation conventions.

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

# API Testing Patterns

## Test File Organisation

```
tests/
├── test_agents.py                 ← AgentService + Agent API
├── test_skills.py                 ← SkillService + Skills API
├── test_auth.py                   ← Auth flows
├── fixtures/
│   ├── auth_fixtures.py           ← mock users, tokens
│   ├── skill_fixtures.py          ← sample skills, schemas
│   └── agent_fixtures.py          ← sample agents
└── mocks/
    ├── marketplace_mock.py        ← MarketplaceAdapter mock
    └── kms_mock.py                ← CryptoService mock
```

Each significant feature: split into two test classes:
- `TestXxxServiceUnit` — mocks DB directly, tests business logic
- `TestXxxAPI` — uses `AsyncClient`, tests HTTP layer (auth, routing, status codes)

## Test Class Template

```python
import uuid
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def org_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def mock_user(org_id):
    user = MagicMock()
    user.id = uuid.uuid4()
    user.org_id = org_id
    user.email = "test@example.com"
    user.is_provider_admin = False
    return user


@pytest.fixture
def mock_db():
    db = AsyncMock(spec=AsyncSession)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    db.refresh = AsyncMock()
    return db


# ── Service unit tests ────────────────────────────────────────────────

class TestAgentServiceUnit:
    """Business logic — mocks DB directly."""

    @pytest.mark.asyncio
    async def test_create_agent_sets_org_id(self, mock_db, org_id):
        from app.services.agent_service import AgentService
        svc = AgentService(mock_db)

        # Mock scalar_one_or_none for org lookup
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock(id=org_id)
        mock_db.execute.return_value = mock_result

        agent = await svc.create_agent(name="Test", org_id=org_id)

        assert agent.org_id == org_id
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()


# ── API integration tests ─────────────────────────────────────────────

class TestAgentAPI:
    """HTTP layer — tests auth, routing, serialisation, status codes."""

    @pytest.mark.asyncio
    async def test_create_agent_returns_201(self, mock_user, mock_db):
        with patch("app.api.deps.get_current_user", return_value=mock_user), \
             patch("app.api.deps.get_db", return_value=mock_db):

            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.post(
                    "/api/v1/agents",
                    json={"name": "Test Agent", "description": "Testing"},
                    headers={"Authorization": "Bearer fake-token"},
                )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Agent"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_unauthenticated_returns_401(self):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/agents", json={"name": "Test"})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_cross_org_access_returns_404(self, mock_user, mock_db):
        """Org B cannot access Org A resources — returns 404 (hides existence)."""
        other_org_id = uuid.uuid4()
        mock_result = MagicMock()
        # Resource exists but belongs to other org — should return 404
        agent = MagicMock()
        agent.org_id = other_org_id  # NOT mock_user.org_id
        mock_result.scalar_one_or_none.return_value = agent
        mock_db.execute.return_value = mock_result

        with patch("app.api.deps.get_current_user", return_value=mock_user), \
             patch("app.api.deps.get_db", return_value=mock_db):

            async with AsyncClient(app=app, base_url="http://test") as client:
                response = await client.get(
                    f"/api/v1/agents/{uuid.uuid4()}",
                    headers={"Authorization": "Bearer fake-token"},
                )

        assert response.status_code == 404  # NOT 403 — 403 leaks existence
```

## Sequential DB Call Mocking

```python
# For services that call db.execute() multiple times
# Use list form — Python pops from list on each call
db.execute = AsyncMock(side_effect=[
    first_result,   # call 1: existence check
    second_result,  # call 2: the actual query
    third_result,   # call 3: audit log insert
])

# NOT the function form (returns same thing each call):
# db.execute = AsyncMock(return_value=some_result)  ← only if all calls same
```

## Bulk-Load Pattern Mocking

```python
# When production code uses .scalars().all() for bulk load
bulk_result = MagicMock()
bulk_result.scalars.return_value.all.return_value = [model1, model2]
db.execute.return_value = bulk_result

# When production code uses .scalar_one_or_none() for single item
single_result = MagicMock()
single_result.scalar_one_or_none.return_value = some_model
db.execute.return_value = single_result
```

## Test Naming Convention

```
test_{what}_{condition}_{expected}

test_create_agent_with_valid_data_returns_201
test_get_agent_wrong_org_returns_404
test_search_skills_empty_query_returns_all
test_bind_skill_unvetted_trust_tier_returns_403
```

## Anti-Patterns to Avoid

- Testing implementation details (mocking internal methods instead of DB)
- Asserting `== "managed"` when production uses `org_id is not None` — set `p.org_id = None` not just `p.created_by = None`
- `MagicMock()` for fields checked with `is not None` — always set the field explicitly
- Sharing test state between tests (use fixtures, not module-level variables)
- Not testing the unhappy path (missing auth, wrong org, invalid input)
