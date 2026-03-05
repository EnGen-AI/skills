---
name: git-workflow
version: 1.0.0
description: |
  Git workflow conventions for EnGenAI: conventional commits, branch strategy,
  sprint branching model, PR process, and merge rules.

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

# Git Workflow

## Branch Strategy

```
develop         ← North star — clean, tested, reviewed code only (PR merges only)
sprint-XX-name  ← Active sprint work (one branch per sprint)
gitops/dev      ← CI/CD state — managed by pipeline only, never touch manually
gitops/marketing← Marketing CI/CD state — managed by pipeline only
```

### Rules — No Exceptions

- NEVER push directly to `develop` or `main`
- NEVER push to `gitops/*` branches (CI/CD does this automatically)
- NEVER merge any PR — merges are done manually by Amad or Nic ONLY
- ALL work goes to a sprint branch → test → approval → PR

### Sprint Naming

| Situation | Branch Name |
|-----------|-------------|
| New sprint | `sprint-16-coding-assistants` |
| Revisiting sprint (first time) | `sprint-11b-licensing-review` |
| Revisiting sprint (again) | `sprint-11c-licensing-followup` |
| Never | Reusing an old sprint branch |

## Conventional Commits

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scope: infra, canvas, nodes, connections, api, auth, skills, agents

Examples:
  feat(skills): add marketplace adapter replacing clawhub
  fix(api): correct org_id null check in provider router
  test(skills): add content hash verification tests
  chore(sprint-22): update sprint plan with Phase C skills
```

### Rules
- Description in lowercase imperative mood ("add" not "added" or "adds")
- No trailing period
- Reference ticket/issue in body if applicable
- Breaking changes: add `!` after type/scope and `BREAKING CHANGE:` footer

## Sprint Workflow

```
1. git pull origin develop          ← always start here
2. git checkout -b sprint-XX-desc   ← new branch every sprint
3. [work + commit + push sprint]    ← CI/CD auto-deploys to dev.engenai.app
4. [test on dev.engenai.app]        ← iterate until satisfied
5. [document locally]               ← logs, lessons, closure docs (NO commit yet)
6. Wait for Amad's EXPLICIT approval to close
7. Commit closure docs + push sprint branch
8. Open PR: sprint-XX → develop     ← notify Nic
9. Nic reviews → approves → merges  ← AI does NOT merge
10. git pull origin develop         ← sync before next sprint
```

## Commit Message Format (HEREDOC for multi-line)

```bash
git commit -m "$(cat <<'EOF'
feat(scope): description

Body explaining the why, not the what.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## PR Template

```markdown
## Summary
- Bullet-point list of what changed and why

## Test Plan
- [ ] Unit tests pass
- [ ] Physical test on dev.engenai.app
- [ ] No regressions in existing tests

## Impact
- Files changed: N
- Test count: before → after
```

## Common Mistakes to Avoid

- Amending published commits — creates divergence in CI/CD
- Skipping `--no-verify` — fix the hook instead
- `git add -A` — always stage specific files to avoid committing secrets
- Direct pushes to develop — even "hotfixes" must go through a branch and PR
