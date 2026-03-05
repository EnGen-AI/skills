---
name: code-review
version: 2.0.0
description: |
  Two-stage code review process for EnGenAI. Stage 1 checks spec compliance,
  Stage 2 checks code quality. Stage 2 cannot begin until Stage 1 passes.
  Based on the Superpowers research pattern.

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
tags: [review, quality, spec-compliance, code-quality]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Code Review

Two-stage review gate. Stage 2 cannot begin until Stage 1 passes.

## Pre-Conditions

- Code is committed (or staged)
- Tests are passing
- Author has run lint and type checks

## Stage 1: Spec Compliance

Does the code do what was asked?

```checklist
- [ ] All acceptance criteria met
- [ ] No missing requirements
- [ ] No scope creep (extra features not requested)
- [ ] Edge cases handled per spec
- [ ] Error responses match API contract
```

**If Stage 1 FAILS:** Return to author with specific gaps. Do NOT proceed to Stage 2.

## Stage 2: Code Quality

Is the code well-built?

```checklist
- [ ] Follows project coding standards
- [ ] Backend: async, typed, Pydantic validated, structured errors
- [ ] Frontend: TypeScript strict, Tailwind, accessible, no `any`
- [ ] No security vulnerabilities (OWASP Top 10)
- [ ] No hardcoded secrets or credentials
- [ ] Tests are meaningful (not just passing)
- [ ] No unnecessary complexity (YAGNI)
- [ ] Performance acceptable (no N+1 queries, no blocking calls)
- [ ] Security: kill switch checked, output validated, org scope enforced
```

## Impact Assessment

```checklist
- [ ] Impact level classified (LOW/MEDIUM/HIGH)
- [ ] Affected areas identified
- [ ] If HIGH: CTO notified before merge
- [ ] Breaking changes documented
```

## Final Verdict

| Verdict | Meaning | Action |
|---------|---------|--------|
| APPROVED | Both stages pass | Merge |
| CHANGES_NEEDED | Issues found | Return with specific feedback |
| BLOCKED | Architectural concern | Escalate to CTO |

## Post-Conditions

- Review recorded in sprint log
- If APPROVED: code merged or ready for merge
- If CHANGES_NEEDED: specific actionable feedback provided
- If BLOCKED: CTO notified with context
