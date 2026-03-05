---
name: k8s-deploy
version: 1.0.0
description: |
  Kubernetes deployment patterns for EnGenAI: manifest best practices,
  resource limits, health probes, ArgoCD GitOps workflow, Helm chart
  conventions, and GKE-specific configuration.

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

# Kubernetes Deployment Patterns

## GitOps Flow (ArgoCD)

```
sprint-XX push
  └── GitHub Actions builds image → pushes to GCP Artifact Registry
  └── CI commits new image tag to gitops/dev branch (values.yaml)
ArgoCD watches gitops/dev
  └── Detects tag change → syncs Deployment
  └── Init container runs: alembic upgrade head
  └── Rolling update: new pods up → old pods down
```

**Rules:**
- NEVER push to `gitops/dev` manually — CI/CD only
- NEVER edit image tags in manifests directly — update via CI values
- Check ArgoCD dashboard after every push: `kubectl get pods -n engenai-dev`

## Deployment Manifest Template

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: engenai-api
  namespace: engenai-dev
  labels:
    app: engenai-api
    version: "{{ .Values.image.tag }}"
spec:
  replicas: 2
  selector:
    matchLabels:
      app: engenai-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # zero-downtime rolling update
  template:
    metadata:
      labels:
        app: engenai-api
    spec:
      serviceAccountName: engenai-api-sa
      securityContext:
        runAsUser: 1001
        runAsNonRoot: true
        fsGroup: 1001
      containers:
        - name: api
          image: "europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:{{ .Values.image.tag }}"
          ports:
            - containerPort: 8000
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 2
          envFrom:
            - secretRef:
                name: engenai-api-secrets
          volumeMounts:
            - name: tmp
              mountPath: /tmp          # allow writes only to /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      initContainers:
        - name: migrate
          image: "europe-west2-docker.pkg.dev/engenai-dev/engenai/platform:{{ .Values.image.tag }}"
          command: ["alembic", "upgrade", "head"]
          envFrom:
            - secretRef:
                name: engenai-api-secrets
          securityContext:
            runAsUser: 1001
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
```

## Resource Limits (Mandatory)

Every container MUST have both `requests` and `limits`. Missing limits → pod evicted under pressure.

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---|---|---|---|---|
| api | 250m | 1000m | 256Mi | 512Mi |
| worker (Celery) | 500m | 2000m | 512Mi | 1Gi |
| beat (scheduler) | 100m | 250m | 128Mi | 256Mi |
| frontend | 100m | 500m | 128Mi | 256Mi |
| agent-worker | 500m | 2000m | 512Mi | 1Gi |

## Health Probes (Mandatory)

```yaml
# Liveness: restart if stuck (check every 30s, allow 10s startup)
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 30
  failureThreshold: 3

# Readiness: remove from Service if not ready (check every 10s)
readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 2
```

**Both probes are mandatory.** No probe = broken rolling updates (old pod removed before new pod ready).

## Agent Worker — gVisor RuntimeClass

```yaml
# Agent worker pods run in gVisor sandbox (security isolation)
spec:
  runtimeClassName: gvisor
  containers:
    - name: agent-worker
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
        seccompProfile:
          type: Localhost
          localhostProfile: agent-worker-profile.json
```

## NetworkPolicy — Default Deny for Agent Workers

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-worker-deny-all
  namespace: engenai-dev
spec:
  podSelector:
    matchLabels:
      app: agent-worker
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: engenai-dev
      ports:
        - port: 6379   # Redis
        - port: 5432   # PostgreSQL
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
              - 169.254.0.0/16   # GCP metadata endpoint
      ports:
        - port: 443    # LLM provider APIs only
```

## Debugging Commands

```bash
# Check pod status
kubectl get pods -n engenai-dev

# Tail logs (real-time)
kubectl logs -f -n engenai-dev -l app=engenai-api

# Check recent events
kubectl describe pod -n engenai-dev <pod-name> | tail -20

# Check ArgoCD sync status
kubectl get applications -n argocd

# Check resource usage
kubectl top pods -n engenai-dev
```

## Common Issues

| Symptom | Check |
|---|---|
| Pod in `CrashLoopBackOff` | `kubectl logs <pod>` — usually startup error or missing secret |
| Pod in `Pending` | `kubectl describe pod <pod>` — usually resource quota or node capacity |
| 404 on all endpoints | `curl /api/v1/health` — check `build` field matches expected SHA |
| Rolling update stalled | Readiness probe failing on new pod — check app startup logs |
| ArgoCD `OutOfSync` | CI failed to push tag update to `gitops/dev` — check CI logs |
