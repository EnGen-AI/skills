---
name: dependency-audit
version: 1.0.0
description: |
  Dependency security audit workflow for EnGenAI: CVE scanning,
  supply chain verification, dependency pinning strategy,
  and remediation process for vulnerable packages.

engenai:
  category: security
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

# Dependency Audit Workflow

## When to Run

- Before every PR merge to `develop`
- Weekly (automated via Celery beat job)
- Before any new dependency is added
- After any security advisory affecting our stack

## Python Backend Audit

```bash
cd src/backend

# Safety — checks against PyPI Advisory Database
safety check -r requirements.txt --full-report

# pip-audit — checks against OSV database
pip-audit -r requirements.txt --format json --output audit-report.json

# Bandit — static security analysis
bandit -r app/ -f json -o bandit-report.json

# Check for dependency confusion (packages with same name on PyPI vs private)
# Any private package names in requirements.txt must be verified
```

## Frontend Audit

```bash
cd src/frontend

# npm audit
npm audit --audit-level=high --json > npm-audit-report.json

# Check for known malicious packages
npx better-npm-audit audit
```

## Severity Response Matrix

| CVSS Score | Severity | Action | Timeline |
|---|---|---|---|
| 9.0–10.0 | CRITICAL | Block deploy, immediate patch | Same day |
| 7.0–8.9 | HIGH | Patch before next sprint | Within 3 days |
| 4.0–6.9 | MEDIUM | Schedule patch | Within sprint |
| 0.1–3.9 | LOW | Track, patch opportunistically | Backlog |

## Patching Process

```bash
# 1. Identify vulnerable package
safety check -r requirements.txt | grep "vulnerability"

# 2. Check if patch version exists
pip index versions <package-name>

# 3. Update to patched version
# Edit requirements.txt: package==1.2.3 → package==1.2.4

# 4. Run test suite to verify no regressions
python -m pytest --tb=short -q

# 5. Run audit again to confirm resolved
safety check -r requirements.txt
```

## Dependency Pinning Rules

```
# requirements.txt — ALWAYS pin exact versions
fastapi==0.115.6          # good
fastapi>=0.100.0          # bad — transitive update risk
fastapi                   # worst — unbounded

# Exception: dev dependencies can use >= with upper bound
pytest>=8.0,<9.0          # acceptable for dev-only tools
```

## Supply Chain Verification

Before adding any new dependency:

- [ ] Package maintained (last commit < 12 months)
- [ ] PyPI download count > 10,000/month (low adoption = high risk)
- [ ] No known typosquatting (verify exact package name on PyPI)
- [ ] No transitive dependency on ClawHub, OpenClaw, or compromised registries
- [ ] License compatible with Apache-2.0 (our licence)
- [ ] SBOM entry added to `infrastructure/sbom.json`

## GitHub Actions — Automated Scanning

```yaml
# In CI pipeline (runs on every PR)
- name: Security audit
  run: |
    pip install safety pip-audit bandit
    safety check -r src/backend/requirements.txt
    pip-audit -r src/backend/requirements.txt
    bandit -r src/backend/app/ -l -ii  # fail on HIGH severity only

- name: npm audit
  run: |
    cd src/frontend
    npm audit --audit-level=high
```

## Licence Compliance

```bash
# Check all dependency licences
pip-licenses --format=json --output-file=licenses.json

# Forbidden licences (incompatible with commercial use):
# GPL-2.0, GPL-3.0, AGPL-3.0, LGPL-2.1 (in some cases)
# Permitted: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
```

## Remediation Decision Tree

```
CVE found in dependency X
├── Is there a patched version?
│   ├── YES → Update requirements.txt, run tests, PR
│   └── NO → Is there an alternative package?
│       ├── YES → Replace package, update all imports, PR
│       └── NO → Can we vendor/fork the fix?
│           ├── YES → Add patched version to vendor/, document
│           └── NO → Escalate to Amad — may need feature removal
│
├── Does the CVE affect our usage pattern?
│   └── Document non-applicability with evidence in PR
│
└── CRITICAL CVE → Block all PRs until resolved
```
