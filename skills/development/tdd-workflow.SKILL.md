---
name: tdd-workflow
version: 2.0.0
description: |
  Test-Driven Development workflow for EnGenAI backend and frontend code.
  Write failing tests first, then implement, then verify with evidence.
  Never claim "done" without running the verification command.

engenai:
  category: development
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
tags: [tdd, testing, pytest, jest, verification]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# TDD Workflow

Write failing tests first, then implement code to make them pass, then refactor.
Never claim "done" without verification evidence.

## Pre-Conditions

- Clear requirements or acceptance criteria defined
- Target files identified
- Relevant existing code read and understood

## Step 1: Design (Before Coding)

```checklist
- [ ] Requirements clarified (ask questions until understood)
- [ ] Acceptance criteria written
- [ ] Files to create/modify identified
- [ ] Impact classification done (LOW/MEDIUM/HIGH)
```

## Step 2: Write Failing Tests

**Backend (pytest):**
```python
async def test_create_skill_success(db_session):
    result = await skill_service.create(db_session, SkillCreate(name="test-skill"))
    assert result.id is not None
    assert result.name == "test-skill"
```

**Frontend (Jest + RTL):**
```typescript
it('renders skill card with trust tier badge', () => {
  render(<SkillCard skill={mockSkill} />)
  expect(screen.getByText('official')).toBeInTheDocument()
})
```

Run tests — they should **FAIL** (red). If they pass already, the test is wrong.

## Step 3: Implement Code

Write the **minimum** code to make tests pass. Follow coding standards:
- Backend: async, typed, Pydantic validated, structured errors
- Frontend: TypeScript strict, Tailwind only, accessible, no `any`

## Step 4: Verify (5-Step Gate)

```
1. IDENTIFY — What command proves this works?
2. RUN      — Execute fresh (no cached results)
3. READ     — Read complete output
4. VERIFY   — Does output confirm claim?
5. CLAIM    — Only now say "done" with evidence
```

```bash
# Backend
cd src/backend
pytest tests/ -v --tb=short
ruff check app/
mypy app/

# Frontend
npx jest --coverage
npx tsc --noEmit
```

## Step 5: Refactor (If Needed)

```checklist
- [ ] Remove duplication
- [ ] Improve naming
- [ ] Extract helpers only if used 3+ times
- [ ] Re-run ALL tests after refactor
```

## Red Flags (Stop Immediately)

- "Should work" — run the test
- "Probably passes" — run the test
- "Great! Done!" before verification — run the test
- Same error 3 times — escalate (3-strike rule to CTO)

## Post-Conditions

- All new tests pass (green)
- All existing tests still pass (no regression)
- Lint and type checks pass (0 errors)
- Evidence of verification captured in sprint log
