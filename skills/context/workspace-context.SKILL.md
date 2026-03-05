---
name: workspace-context
version: 1.0.0
description: |
  EnGenAI platform workspace overview — project identity, tech stack, team
  structure, terminology, and development principles. Read-only reference for
  all agents operating in the EnGenAI codebase.

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
tags: [context, workspace, stack, conventions]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# EnGenAI Workspace Context

## Project Identity

**Project:** EnGenAI (AI-Native Software Development Orchestration Platform)
**Tagline:** "The Machine That Builds Machines"
**Domain:** EnGenAI.app
**CTO/Chief Architect:** Amad
**CPO:** Keith

EnGenAI = Engineering Generative AI. We are building the machine that creates machines.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + React 18 |
| Canvas | React Flow |
| Styling | Tailwind CSS |
| State | Zustand |
| Backend | FastAPI (Python 3.11+) |
| Database | PostgreSQL (async via SQLAlchemy) |
| Cache | Redis (aioredis) |
| Knowledge Graph | Memgraph |
| Vector DB | Milvus |
| Queue | Celery + Redis |
| Container | GCP GKE (K8s), non-root UID 1001 |
| GitOps | ArgoCD (gitops/dev branch) |

## Repository Structure

```
Platform/
├── src/
│   ├── backend/      — FastAPI app (Sophi's domain)
│   ├── frontend/     — Next.js app (Marv's domain)
│   └── shared/       — Shared types/utilities
├── infrastructure/   — Terraform, Helm, K8s manifests, ArgoCD
├── tasks/            — Sprint 3-file pattern (PLAN, LOG, NOTES)
├── docs/             — Architecture docs, LLDs, ADRs
├── agent-ops/        — Agent identity files, skills, LESSONS_LEARNED
└── design/           — High-level design (2 files: infra + app)
```

## Terminology Standards

| Use | Don't Use |
|-----|-----------|
| PROMI (ALL CAPS) | Promi, promi |
| Company (new code/UI) | Organization (new code) |
| Organization (API paths only) | Don't create new /companies/ paths |
| Provider = EnGenAI platform | — |
| Company Admin = customer's admin | — |
| Provider Admin = EnGenAI staff admin | — |
| Starter / Pro / Enterprise | basic, premium, free |
| USD / $ | £, €, GBP |
| EnGenAI Skills Marketplace | ClawHub, OpenClaw, OpenHub |

## Plan Tiers

- **Starter** $149/mo — entry tier
- **Pro** $269/mo — mid tier
- **Enterprise** — Contact Us

## Development Principles

1. **Design First** — Never code without a clear spec
2. **TDD** — Failing test first, then code, then refactor
3. **Evidence Before Claims** — IDENTIFY → RUN → READ → VERIFY → CLAIM
4. **Small Batches** — 2-5 minute tasks, frequent commits
5. **Physical Testing** — Deploy to real environment, hit real endpoints
6. **3-Strike Rule** — 3 failures = STOP and escalate to CTO

## Impact Gate

| Impact | Examples | Action |
|--------|----------|--------|
| LOW | Typos, comments, tests, styling | Auto-proceed |
| MEDIUM | API changes, schema changes, shared components | Notify affected areas |
| HIGH | Breaking changes, security, architecture, >3 areas | Escalate to Amad |

## Commit Format

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(api): add skill discovery endpoint
```
