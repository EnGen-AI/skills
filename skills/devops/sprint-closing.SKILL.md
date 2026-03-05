---
name: sprint-closing
version: 2.0.0
description: |
  Close an EnGenAI sprint with the mandatory 6-phase process. Every sprint
  must be fully documented and Amad must give explicit approval before any
  closure docs are committed and pushed.

engenai:
  category: devops
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
tags: [sprint, closure, documentation, process]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
  - Never commit closure docs before Amad gives explicit approval.
---

# Sprint Closing

Mandatory 6-phase process. Phases 1–5 are ALL local. Nothing is committed
until Amad gives explicit approval.

## Pre-Conditions

- All planned tasks completed or explicitly deferred with reason
- Code committed and pushed to sprint branch — NOT develop
- Amad has given EXPLICIT approval to close

## Phase 1: Verify All Work

```checklist
- [ ] All planned tasks completed or explicitly deferred
- [ ] All code committed to correct sprint branch
- [ ] Tests passing (run fresh — no cached results)
- [ ] No unresolved blockers
- [ ] Physical testing done on dev.engenai.app
```

```bash
pytest src/backend/tests/ -v
ruff check src/backend/
mypy src/backend/app/
git status && git log --oneline -5
```

## Phase 2: Documentation Updates

```checklist
- [ ] docs/INFRASTRUCTURE_LLD.md updated if infrastructure changed
- [ ] docs/ENGENAI_MASTER_DESIGN.md updated if app architecture changed
- [ ] docs/ROADMAP.md updated with completed items
- [ ] docs/SPRINT_BREAKDOWN.md updated with sprint status
- [ ] docs/BACKLOG.md updated (completed removed, new added)
- [ ] ADRs created for any architecture decisions made
```

## Phase 3: Lessons Learned

```checklist
- [ ] Review agent-ops/LESSONS_LEARNED.md
- [ ] Add new lessons from this sprint
- [ ] Categorise by type (infrastructure, code, process, tooling)
- [ ] Include what worked AND what didn't
- [ ] Reference specific files/commands
```

## Phase 4: Sprint Closure Report

Create `tasks/SPRINT_XX_NAME/SPRINT_XX_COMPLETE.md` with:
- Executive summary (2–3 sentences)
- Metrics table (planned / completed / deferred / files / tests)
- Deliverables table with status and file paths
- Infrastructure changes
- Deployment verification with evidence
- Lessons learned
- Next sprint preview

## Phase 5: Update Agent Memory

```checklist
- [ ] Update MEMORY.md with key learnings
- [ ] Update LESSONS_LEARNED.md with final items
- [ ] Verify CLAUDE.md is current
```

## Phase 6: Commit, Push, Open PR (Requires Amad's EXPLICIT Approval)

```checklist
- [ ] Amad has given explicit go-ahead
- [ ] git add <closure doc files only>
- [ ] git commit -m "docs(sprint-XX): sprint closure — log, lessons, closure report"
- [ ] git push origin sprint-XX-name (NOT develop)
- [ ] Open PR: sprint-XX-name → develop
- [ ] Notify Nic: "Sprint XX tested, documented, ready for review"
- [ ] Do NOT merge — merge done manually by Amad or Nic only
```

## Post-Conditions

- Closure report at `tasks/SPRINT_XX_NAME/SPRINT_XX_COMPLETE.md`
- All docs committed and pushed to sprint branch
- PR open on GitHub
- Lessons captured in LESSONS_LEARNED.md
- CTO sign-off obtained
