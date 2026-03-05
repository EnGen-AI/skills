---
name: container-build
version: 1.0.0
description: |
  Container image build patterns for EnGenAI: multi-stage Containerfiles,
  non-root UID 1001, security hardening, GitHub Actions CI build pipeline,
  GCP Artifact Registry push, and ArgoCD GitOps deployment integration.

engenai:
  category: devops
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

# Container Build Patterns

## Architecture

```
GitHub Actions
  └── Build multi-stage image
  └── Push to GCP Artifact Registry (europe-west2-docker.pkg.dev/engenai-dev/...)
  └── Update gitops/dev image tag
ArgoCD watches gitops/dev
  └── Syncs K8s Deployment with new image tag
  └── Init container runs Alembic migrations
  └── Pods roll to new version
```

**There is no local dev environment. All development runs on GCP K8s.**

## Multi-Stage Backend Containerfile

```dockerfile
# Stage 1: Build dependencies
FROM python:3.12-slim AS builder
WORKDIR /build
COPY src/backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Production image — minimal attack surface
FROM python:3.12-slim AS production

# Non-root user — MANDATORY (UID 1001)
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -s /bin/sh -m appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code with correct ownership
COPY --chown=appuser:appgroup src/backend/app ./app
COPY --chown=appuser:appgroup src/backend/alembic ./alembic
COPY --chown=appuser:appgroup src/backend/alembic.ini .

# Enforce read-only app directory
RUN chmod -R 550 /app

# Switch to non-root before EXPOSE / CMD
USER 1001

ENV PATH="/home/appuser/.local/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Security Requirements (Mandatory)

```dockerfile
# Always numeric UID — K8s runAsNonRoot rejects string usernames
USER 1001

# Remove unnecessary binaries
RUN apt-get purge -y --auto-remove curl wget netcat 2>/dev/null; \
    rm -rf /var/lib/apt/lists/*
```

Enforced by K8s security context (set in Helm chart / manifests):
```yaml
securityContext:
  runAsUser: 1001
  runAsNonRoot: true
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: [ALL]
```

## Layer Caching Strategy

```dockerfile
# WRONG — any code change busts dependency cache
COPY . .
RUN pip install -r requirements.txt

# RIGHT — requirements cached separately from application code
COPY src/backend/requirements.txt .      # only invalidated when deps change
RUN pip install -r requirements.txt
COPY src/backend/app ./app               # only layer that changes on code edits
```

## .containerignore / .dockerignore

```
.git
.github
**/__pycache__
**/*.pyc
**/.pytest_cache
**/.mypy_cache
node_modules
.next
.env
*.env.*
*.log
tasks/
docs/
research/
infrastructure/terraform/
```

## GitHub Actions Build Job

```yaml
- name: Set up GCP auth
  uses: google-github-actions/auth@6fc4af4b145ae7821d527454aa9bd537d1f2dc5f  # v2.1.7
  with:
    workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
    service_account: ${{ secrets.GCP_SA_EMAIL }}

- name: Configure Artifact Registry
  run: gcloud auth configure-docker europe-west2-docker.pkg.dev --quiet

- name: Build and push
  uses: docker/build-push-action@4f58ea79222b3b9dc2c8bbdd6debcef730109a75  # v6.9.0
  with:
    context: .
    file: infrastructure/containerfiles/Containerfile.backend
    push: true
    tags: |
      europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:latest
      europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:sha-${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

## Image Tagging Convention

```
# Production K8s always uses the SHA tag (never :latest)
europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:sha-${GITHUB_SHA}
europe-west2-docker.pkg.dev/engenai-dev/engenai/marketing:sha-${GITHUB_SHA}

# ArgoCD gitops/dev branch stores this tag in values.yaml
# CI updates it automatically after push
```

## CVE Scan in CI

```yaml
- name: Scan for CVEs
  uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d8  # v0.28.0
  with:
    image-ref: europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:sha-${{ github.sha }}
    format: sarif
    severity: CRITICAL,HIGH
    exit-code: 1
```

## Verification Checklist

- [ ] Image runs as UID 1001 (enforced by K8s `runAsNonRoot: true`)
- [ ] Base image pinned to specific version (e.g., `python:3.12-slim`)
- [ ] Layer count minimised — deps stage separate from app stage
- [ ] No secrets baked into image layers
- [ ] Trivy scan: 0 CRITICAL CVEs before promoting to prod
- [ ] ArgoCD shows `Synced` and all pods `1/1 Running` after deploy
