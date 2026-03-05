---
name: performance-profiling
version: 1.0.0
description: |
  Performance profiling workflow for EnGenAI: Python async profiling,
  PostgreSQL query analysis, K8s resource metrics, and systematic
  diagnosis of latency regressions.

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

# Performance Profiling Workflow

## Step 1 — Identify the Bottleneck First

Before profiling: establish a baseline measurement. Never optimise without data.

```bash
# API response time baseline
curl -w "\n%{time_total}s\n" -o /dev/null -s \
  -H "Authorization: Bearer $TOKEN" \
  https://dev.engenai.app/api/v1/agents

# K8s resource usage
kubectl top pods -n engenai-dev
kubectl top nodes

# Check if problem is CPU, memory, or I/O
kubectl describe pod <pod-name> -n engenai-dev | grep -A5 "Limits\|Requests"
```

## Python Async Profiling

```python
# cProfile — synchronous profiling
import cProfile
import pstats
import io

pr = cProfile.Profile()
pr.enable()
# ... code to profile ...
pr.disable()

s = io.StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
ps.print_stats(20)
print(s.getvalue())
```

```python
# py-spy — production-safe sampling profiler (no code changes needed)
# In CI/dev pod:
# pip install py-spy
# py-spy top --pid <pid>
# py-spy record --pid <pid> --output profile.svg --duration 30
```

## Async/Await Profiling

Common async performance traps:

```python
# SLOW: N+1 query — one DB call per agent
for agent in agents:
    agent.skills = await db.execute(select(Skill).where(...agent.id...))

# FAST: single query with IN clause
agent_ids = [a.id for a in agents]
result = await db.execute(
    select(Skill).where(Skill.agent_id.in_(agent_ids))
)
skills_by_agent = defaultdict(list)
for skill in result.scalars():
    skills_by_agent[skill.agent_id].append(skill)

# SLOW: sequential async calls
a = await fetch_a()
b = await fetch_b()

# FAST: parallel async calls
a, b = await asyncio.gather(fetch_a(), fetch_b())
```

## PostgreSQL Query Analysis

```sql
-- Find slow queries (requires pg_stat_statements extension)
SELECT
    query,
    calls,
    mean_exec_time,
    total_exec_time,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries > 100ms average
ORDER BY mean_exec_time DESC
LIMIT 10;

-- EXPLAIN ANALYZE for specific query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM agents
WHERE org_id = 'org-uuid-here'
  AND is_active = TRUE
ORDER BY created_at DESC
LIMIT 20;
```

### Index Strategy

```sql
-- Confirm index is being used (check "Index Scan" in EXPLAIN output)
-- If "Seq Scan" on large table → add index

-- Common missing indexes on EnGenAI schema:
CREATE INDEX CONCURRENTLY ix_agents_org_created
  ON agents (org_id, created_at DESC)
  WHERE is_active = TRUE;

CREATE INDEX CONCURRENTLY ix_skill_audit_log_org_time
  ON skill_audit_log (org_id, created_at DESC);
```

### Connection Pool

```python
# SQLAlchemy async engine pool tuning
# Default pool_size=5 may be too small under load
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,        # simultaneous connections (per worker pod)
    max_overflow=5,      # burst connections above pool_size
    pool_timeout=30,     # wait time before "pool exhausted" error
    pool_recycle=1800,   # recycle connections every 30min
    pool_pre_ping=True,  # verify connection alive before use
)
```

## Redis Performance

```bash
# Connect to Redis pod
kubectl exec -n engenai-dev -it <redis-pod> -- redis-cli

# Check slow queries
SLOWLOG GET 10

# Check memory usage
INFO memory

# Check key count and distribution
DBSIZE
INFO keyspace
```

## K8s Resource Optimisation

```bash
# Vertical Pod Autoscaler recommendation (if VPA installed)
kubectl get vpa -n engenai-dev

# Check for OOMKilled pods (memory limit too low)
kubectl get events -n engenai-dev | grep OOMKilled

# Check CPU throttling
kubectl top pods -n engenai-dev --containers
# If CPU usage consistently near limit → increase CPU limit
```

## Profiling Checklist

- [ ] Baseline response time measured before changes
- [ ] Bottleneck identified: CPU / Memory / DB / External API / Redis
- [ ] N+1 query patterns checked in hot paths
- [ ] Missing indexes identified via EXPLAIN ANALYZE
- [ ] Async `gather()` used for independent concurrent calls
- [ ] After fix: re-measure and confirm improvement with same benchmark
- [ ] No premature optimisation — only fix what's measured as slow
