---
name: incident-response
version: 1.0.0
description: |
  Incident response runbook for EnGenAI: classification, blast radius
  containment, kill switch activation, evidence preservation,
  and post-incident review process.

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

# Incident Response Runbook

## Severity Classification

| Level | Criteria | Response Time | Owner |
|---|---|---|---|
| P0 CRITICAL | Data exfiltration, prompt injection confirmed, cross-org data leak, platform-wide compromise | Immediate | Amad (CTO) |
| P1 HIGH | Skill injection attempt detected, agent spawned subprocess, unexpected outbound TCP, KMS failure | < 15 min | On-call |
| P2 MEDIUM | Single agent misbehaviour, rate limit exceeded, auth anomaly | < 1 hour | On-call |
| P3 LOW | Performance degradation, non-critical service error | < 4 hours | Team |

## Step 1 — Identify and Classify

```bash
# Check SIEM events (skill_audit_log)
kubectl exec -n engenai-dev -it <api-pod> -- \
  psql $DATABASE_URL -c \
  "SELECT event_type, severity, created_at, details FROM skill_audit_log
   WHERE severity IN ('CRITICAL','HIGH') ORDER BY created_at DESC LIMIT 20;"

# Check Tetragon events (subprocess detection)
kubectl logs -n kube-system -l app.kubernetes.io/name=tetragon --tail=100 | grep SIGKILL

# Check pod anomalies
kubectl get events -n engenai-dev --sort-by='.lastTimestamp' | tail -30
```

## Step 2 — Contain (Blast Radius Reduction)

### Activate Kill Switch

```python
# Platform-wide (P0 only — CTO authorisation required)
redis.set("killswitch:platform:all", "1")

# Single skill across all orgs (P0/P1)
redis.set(f"killswitch:skill:{skill_id}", "1")

# Single agent (P1/P2)
redis.set(f"killswitch:agent:{agent_id}", "1")

# Entire org (P0/P1)
redis.set(f"killswitch:org:{org_id}", "1")
```

Or via Admin API:
```bash
curl -X POST https://api.engenai.app/api/v1/admin/kill-switch \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"scope": "skill", "id": "<skill_id>", "reason": "Incident #42"}'
```

### Quarantine Agent Pod

```bash
# Cordon the node running the agent worker
kubectl cordon <node-name>

# Scale down agent worker (stops new executions)
kubectl scale deployment agent-worker --replicas=0 -n engenai-dev
```

## Step 3 — Preserve Evidence

```bash
# Trigger evidence preservation for specific execution
curl -X POST https://api.engenai.app/api/v1/admin/preserve-evidence \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"execution_id": "<execution_id>"}'

# Manual: export audit log for timeframe
kubectl exec -n engenai-dev -it <api-pod> -- psql $DATABASE_URL -c \
  "COPY (SELECT * FROM skill_audit_log
         WHERE created_at > NOW() - INTERVAL '2 hours')
   TO STDOUT WITH CSV HEADER" > /tmp/incident_audit_$(date +%Y%m%d_%H%M%S).csv

# Capture pod logs before any restart
kubectl logs -n engenai-dev -l app=agent-worker --previous > /tmp/agent_worker_prev.log
kubectl logs -n engenai-dev -l app=engenai-api --previous > /tmp/api_prev.log
```

Evidence is auto-preserved to GCS bucket on any `agent_output_flagged` or `skill_injection_attempt_detected` SIEM event.

## Step 4 — Root Cause Analysis

Checklist:
- [ ] Which skill triggered the event? Check `skill_id` in audit log
- [ ] Which agent and org? Check `agent_id`, `org_id`
- [ ] Was the skill vetted (trust_tier, cosign_signature present)?
- [ ] What was the skill content at injection time? (Check `skill_version_history`)
- [ ] Did content hash match stored hash?
- [ ] What capabilities did the skill declare vs what it attempted?
- [ ] Timeline: when was skill last approved? Any content changes since?

## Step 5 — Remediate

```bash
# Reject/deactivate the compromised skill
curl -X POST https://api.engenai.app/api/v1/admin/skills/<skill_id>/reject \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Confirmed injection payload — incident #42"}'

# Force re-vetting of all skills from same author
# (manual review via admin queue)

# Clear kill switch once safe
redis.delete(f"killswitch:skill:{skill_id}")
```

## Step 6 — Post-Incident Review

Within 48 hours:
- [ ] Timeline document: first signal → detection → containment → resolution
- [ ] Root cause documented (not "human error" — find the systemic gap)
- [ ] Control that failed identified
- [ ] Control improvement proposed and assigned
- [ ] LESSONS_LEARNED.md updated
- [ ] Architecture doc updated if threat model changes

## SIEM Events Reference

| Event | Severity | Trigger |
|---|---|---|
| `skill_injection_attempt_detected` | CRITICAL | `sanitise_skill_content()` blocked content |
| `agent_output_flagged` | CRITICAL | `validate_output()` found credentials/hijack |
| `cross_org_redis_key_access` | CRITICAL | Redis key for wrong org accessed |
| `rls_policy_violation` | CRITICAL | DB RLS rejected query |
| `skill_content_hash_mismatch` | HIGH | Content changed post-approval |
| `agent_spawned_subprocess` | HIGH | Tetragon SIGKILL fired |
| `unexpected_outbound_tcp` | HIGH | NetworkPolicy blocked connection |
| `vetting_pipeline_db_modified` | HIGH | Direct DB edit to approved skill |
