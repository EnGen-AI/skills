---
name: deploy-to-dev
version: 3.0.0
description: |
  Deploy to dev.engenai.app via GitOps CI/CD pipeline. Push to sprint branch
  triggers GitHub Actions → builds images → updates gitops/dev → ArgoCD syncs.
  Never push directly to develop or gitops branches.

engenai:
  category: devops
  trust_tier: official
  risk_level: medium
  capabilities_required: []
  allowed_domains: []
  content_hash: ""
  signed_by: ""
  last_reviewed: ""
  reviewer: ""

author: engenai
license: Apache-2.0
updated: 2026-03-05
tags: [deploy, cicd, argocd, gitops, kubernetes]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
  - Never push to develop, main, or gitops/* directly.
---

# Deploy to Dev

Deploy via GitOps. Push to sprint branch triggers everything automatically.

## Pre-Conditions

- All tests passing
- Code committed to sprint branch (`sprint-XX-name`) — NOT develop
- Lint and type checks pass (ruff + mypy: 0 errors)

## Step 1: Pre-Deploy Verification

```bash
cd src/backend
ruff check .
mypy app/ --ignore-missing-imports
python -m pytest tests/ -q
git status
git log --oneline -5
```

## Step 2: Push to Sprint Branch

```bash
# Push to SPRINT BRANCH — never to develop
git push origin sprint-XX-name
```

CI/CD pipeline triggers automatically:
1. Build Docker images (API, App, ShareDB)
2. Push to `us-central1-docker.pkg.dev/engenai-dev/engenai-dev/`
3. Update `gitops/dev` branch values with new image tags
4. ArgoCD detects change and syncs to cluster (~60s)
5. Init container runs `alembic upgrade head` (migrations auto-applied)
6. Post-deploy smoke test (3 Playwright tests)

## Step 3: Monitor CI

```bash
gh run list --limit 3
gh run view <run-id> --log
```

Expected: 3 jobs — Build & Push, Update Helm Values, Post-Deploy Smoke Test.

## Step 4: Verify Deployment

```bash
# Build hash must match latest commit SHA
curl -s https://dev.engenai.app/api/v1/health \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('build','?'))"

git log --oneline -1
# SHA must match — if not, the sprint is NOT deployed
```

## Step 5: Post-Deploy Checklist

```checklist
- [ ] All pods running (api, worker, beat, sharedb, app, marketing)
- [ ] Health endpoint returns 200 with correct build SHA
- [ ] No CrashLoopBackOff or CreateContainerConfigError
- [ ] Migrations applied (alembic at head)
- [ ] CI smoke tests: 3/3 passed
- [ ] Auth gate sweep: all protected endpoints return 401 without token
```

## Rollback

```bash
# Option 1: ArgoCD UI → Application → History → Rollback to previous sync (preferred)

# Option 2: kubectl rollback (on master node via IAP)
sudo KUBECONFIG=/etc/kubernetes/admin.conf kubectl -n engenai-dev \
  rollout undo deployment/engenai-platform-dev-api
```

## Known Gotchas

- **K-37**: `CreateContainerConfigError` = missing K8s Secret — check `kubectl describe pod`
- **C-101**: Celery tasks using async DB must create per-invocation engines
- **C-102**: New ORM columns need Alembic migration — model drift invisible to unit tests
- **P-73**: Dev-token endpoint returns real DB UUIDs — never hardcode fake IDs
- Worker node tag is `k8s-worker` (NOT `engenai-dev-worker`)
- kubectl needs: `sudo KUBECONFIG=/etc/kubernetes/admin.conf kubectl`
