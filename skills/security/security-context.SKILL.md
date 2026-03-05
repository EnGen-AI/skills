---
name: security-context
version: 1.0.0
description: |
  EnGenAI security model — OWASP Top 10 checklist, secure coding rules,
  the Lethal Trifecta threat model, forbidden patterns, and required security
  controls for all agents and skills. Mandatory reference for security reviews.

engenai:
  category: security
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
tags: [context, security, owasp, threat-model, secure-coding]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Security Context

## The Lethal Trifecta

EnGenAI agents operate in a uniquely high-risk context because ALL THREE of these conditions are simultaneously true:

1. **Private org data access** — agents query databases containing confidential company data
2. **Untrusted skill content** — skills are third-party authored and injected into the system prompt
3. **Exfiltration capability** — agents have MCP tools that can make external network calls

Any one condition is manageable. All three together = critical. **Every security decision must account for this trifecta.**

## Sprint 22 Security Controls (Phase 0)

| Control | File | What it does |
|---------|------|-------------|
| Hermetic XML Envelope | `agent_executor.py` | Wraps skill content in `<skills_context>` with IMMUTABLE BOUNDARY comment — prevents skill content from overriding system prompt |
| Skill Sanitiser | `security/skill_sanitiser.py` | Regex + fuzzy match blocks prompt injection patterns in skill content |
| Output Validator | `security/output_validator.py` | Scans LLM responses for credential leaks, behavioural hijack, exfil patterns |
| Kill Switch | `security/kill_switch.py` | Redis-backed 4-level hierarchy: platform → org → agent → skill |
| PostgreSQL RLS | Migrations 025/026 | Row-Level Security enforces org isolation at DB level |
| Tenant Context | `security/tenant_context.py` | ContextVar carries org_id across async call stack |
| Redis Tenant | `security/redis_tenant.py` | `org_key()` namespaces all Redis keys by org |
| DB Immutability | Migration 026 | Trigger blocks content changes on vetted skills |

## OWASP Top 10 — Backend Checklist

Apply to every endpoint and service:

- [ ] **A01 Broken Access Control** — all resources scoped to `org_id`, RLS active, no IDOR
- [ ] **A02 Cryptographic Failures** — no secrets in logs/responses, TLS everywhere, bcrypt/argon2 for passwords
- [ ] **A03 Injection** — SQLAlchemy parameterised queries only, never f-string SQL, sanitise skill content
- [ ] **A04 Insecure Design** — threat model the feature before coding (Lethal Trifecta)
- [ ] **A05 Security Misconfiguration** — no debug mode in prod, restrictive CORS, no default creds
- [ ] **A06 Vulnerable Components** — `pip-audit` on every build, pin dependency versions
- [ ] **A07 Auth Failures** — JWT verified on every request, MFA enforced for admin, session invalidation
- [ ] **A08 Software Integrity** — Cosign sign skills at Gate 4, verify hash at runtime injection
- [ ] **A09 Logging Failures** — structured logs for all CRITICAL/HIGH events, SIEM forwarding
- [ ] **A10 SSRF** — NetworkPolicy blocks RFC-1918, validate all external URL inputs

## Forbidden Patterns (Never Ship These)

```python
# SQL Injection
query = f"SELECT * FROM users WHERE id = '{user_id}'"  # NEVER

# Hardcoded secrets
API_KEY = "sk-abc123"  # NEVER

# Subprocess from agent context
subprocess.run(["ls", "-la"])  # NEVER in agent workers

# Unparameterised Redis keys
redis.get(f"agent:{agent_id}:secret")  # NEVER — use org_key()

# Direct os.environ in services
secret = os.environ["SECRET_KEY"]  # NEVER — use settings.*

# Logging sensitive data
logger.info(f"User logged in: {user.password_hash}")  # NEVER
```

## Secure Coding Patterns

```python
# Correct: parameterised SQL
await db.execute(
    select(User).where(User.id == user_id, User.org_id == org_id)
)

# Correct: org-scoped Redis key
from app.security.redis_tenant import org_key
key = org_key(org_id, "agent", agent_id, "state")

# Correct: settings for config
from app.config import settings
url = settings.EXTERNAL_API_URL

# Correct: kill switch before execution
ks_killed, reason = await kill_switch.check_all(agent_id=agent_id, org_id=org_id)
if ks_killed:
    raise RuntimeError(f"Halted: {reason}")
```

## Security Events (SIEM)

Log these events using structured logging. All CRITICAL events must reach monitoring within 5 seconds.

| Event | Level | Trigger |
|-------|-------|---------|
| `skill_injection_attempt_detected` | CRITICAL | Sanitiser blocked a pattern |
| `agent_output_flagged` | CRITICAL | Output validator blocked a response |
| `cross_org_redis_key_access` | CRITICAL | Redis key accessed outside org namespace |
| `rls_policy_violation` | CRITICAL | RLS blocked a cross-org query |
| `skill_content_hash_mismatch` | HIGH | Cosign hash mismatch at runtime |
| `agent_spawned_subprocess` | HIGH | Tetragon caught execve from agent worker |
| `kill_switch_activated` | HIGH | Any kill switch level triggered |

## Trust Tier Injection Rules

| Tier | Can be injected into agent system prompt? |
|------|------------------------------------------|
| `official` | Yes |
| `verified_partner` | Yes |
| `community_vetted` | Yes |
| `unvetted` | **NO** — browsable only, never injected |
