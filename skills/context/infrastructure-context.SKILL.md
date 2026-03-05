---
name: infrastructure-context
version: 1.0.0
description: |
  EnGenAI infrastructure conventions — GCP GKE, ArgoCD GitOps, Terraform,
  Helm, CI/CD pipeline, K8s deployment patterns, and security hardening
  requirements. Reference for DevOps and infrastructure agents.

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
tags: [context, infrastructure, k8s, gcp, argocd, terraform, cicd]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Infrastructure Context

## Platform Architecture

```
GCP GKE Cluster (engenai-dev / engenai-prod)
├── Namespace: engenai
│   ├── api          (FastAPI, replicas: 2)
│   ├── worker       (Celery worker, replicas: 2)
│   ├── beat         (Celery beat, replicas: 1)
│   ├── frontend     (Next.js, replicas: 2)
│   ├── sharedb      (ShareDB collab server)
│   └── marketing    (Marketing site, separate namespace)
├── Services: PostgreSQL (Cloud SQL), Redis (Memorystore), Milvus, Memgraph
└── Node Pools: standard + agent-worker-pool (gVisor, Sprint 22+)
```

## CI/CD Pipeline (GitOps)

```
sprint-XX push
  → GitHub Actions (Build Docker images, run tests)
  → Push images to Artifact Registry (eu.gcr.io/engenai-*/*)
  → Update image tags in gitops/dev branch
  → ArgoCD detects gitops/dev change
  → ArgoCD syncs → K8s rolling deployment
  → Init container: runs Alembic migrations before app starts
```

**Critical rules:**
- NEVER push directly to `gitops/dev` — CI/CD only
- NEVER push directly to `develop` or `main` — PR only
- Sprint branches auto-deploy to dev.engenai.app on push

## Branch Model

| Branch | Purpose |
|--------|---------|
| `develop` | Clean, reviewed code — PRs only |
| `sprint-XX-name` | Active work — Amad + AI |
| `gitops/dev` | Image tags — CI/CD only |
| `gitops/marketing` | Marketing image tags — CI/CD only |

## Docker Images

- Base: `python:3.11-slim` (backend), `node:20-alpine` (frontend)
- Non-root: all containers run as UID 1001
- Multi-stage builds to minimise image size
- No secrets in Dockerfiles — all from K8s Secrets / GCP Secret Manager

## K8s Deployment Requirements

Every Deployment must include:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: [ALL]
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 10
readinessProbe:
  httpGet:
    path: /health
    port: 8000
```

## Terraform

```
infrastructure/terraform/
├── modules/     — Reusable modules (gke, sql, redis, vpc, iam)
├── environments/
│   ├── dev/     — dev.engenai.app
│   └── prod/    — engenai.app (future)
└── variables.tf
```

- State stored in GCS bucket with versioning + locking
- Workload Identity used for K8s → GCP SA bindings (no service account keys)
- All GCP projects prefixed: `engenai-`

## Helm Charts

```
infrastructure/helm/
├── platform/    — API, worker, beat, frontend, sharedb
└── marketing/   — Marketing site
```

- Values files per environment: `values-dev.yaml`, `values-prod.yaml`
- Image tags updated by CI/CD in gitops branches — never edit manually

## ArgoCD

- Apps defined in `infrastructure/argocd/applications/`
- Watches `gitops/dev` branch for platform, `gitops/marketing` for marketing
- Auto-sync enabled: K8s state converges to gitops within ~60 seconds
- Repo URL: `https://github.com/engenai-platform/platform.git`

## Agent Worker Pool (Sprint 22+)

```
Node pool: agent-worker-pool
  Machine: n2-standard-4
  Sandbox: gVisor (runsc)
  RuntimeClass: gvisor
```

Agent worker pods additionally require:
- NetworkPolicy: default-deny all egress, explicit allowlist (Redis, PostgreSQL, LLM APIs)
- Block RFC-1918 ranges (SSRF prevention — GCP metadata endpoint 169.254.169.254)
- Cilium Tetragon: SIGKILL on unexpected `execve`
- Seccomp profile: block `ptrace`, `bpf`, `mount`, `pivot_root` and others

## Health Endpoints

- `GET /health` — liveness check (returns `{"status": "ok"}`)
- `GET /api/v1/health` — readiness check (checks DB + Redis connectivity)
