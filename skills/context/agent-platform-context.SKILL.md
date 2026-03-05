---
name: agent-platform-context
version: 1.0.0
description: |
  EnGenAI agent platform internals — AgentExecutor, mailbox messaging,
  lead/worker team model, working memory, Celery task infrastructure,
  and the full execution lifecycle. Reference for platform and agent-aware code.

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
tags: [context, agents, executor, memory, celery, teams]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Agent Platform Context

## Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `AgentExecutor` | `services/agent_executor.py` | Orchestrates full agent execution lifecycle |
| `WorkingMemory` | `services/working_memory.py` | Redis-backed session context + state machine |
| `SkillRegistry` | `services/skill_registry.py` | Skill loading, vetting, binding management |
| `KillSwitch` | `security/kill_switch.py` | Redis-backed 4-level execution halt |
| Celery worker | K8s `worker` deployment | Async agent task execution |
| Celery beat | K8s `beat` deployment | Scheduled tasks (re-scan, compression, SLA) |

## Agent Execution Lifecycle

```
Request arrives at POST /agents/{id}/execute
  ↓
1. get_current_user() — JWT verify, set_org_context(org_id)
2. get_db() — activates PostgreSQL RLS for this transaction
3. AgentExecutor.execute(agent_id, conversation_id, message)
   ↓
   3a. Kill switch check (platform → org → agent → skill)
   3b. Load conversation history from DB
   3c. _steer() — build system prompt:
       [Steering Floor] → [Org config] → [Skills envelope] → [Task instructions]
   3d. _load_skill_context() — fetch bound skills, sanitise, wrap in <skills_context>
   3e. _call_llm() — call LLM provider with 30s timeout, 8192 token cap
   3f. validate_output() — check response for credential leaks / hijack
   3g. Persist assistant message to DB
   3h. Return response
```

## Steering System (Multi-Layer)

```
Layer 0 — Steering Floor (org-level, inviolable):
  Locked keys in JSONB — cannot be overridden by any downstream config.
  Example locked keys: max_autonomy_level, forbidden_tools, content_policy.

Layer 1 — Structural constraints:
  Agent builder settings — tool access, memory scope, allowed skills.

Layer 2 — Prompt parameters:
  Tone, verbosity, output format, domain constraints.

Layer 3 — Behavioural parameters:
  Temperature, response length, reasoning depth.
```

## Team Model (Lead/Worker)

```
Lead agent
  ├── Claims project task atomically (Redis SETNX)
  ├── Decomposes into sub-tasks
  ├── Routes to worker agents via mailbox
  └── Aggregates worker results

Worker agent
  ├── Polls mailbox for tasks
  ├── Executes autonomously
  ├── Posts result back to lead mailbox
  └── Max 3 levels of nesting, max 10 sub-tasks per parent (Sprint 22 limits)
```

## Working Memory (Redis)

```python
# Session context (TTL: 3600s)
await working_memory.store_context(agent_id, "key", {"data": ...})
context = await working_memory.get_context(agent_id, "key")

# State machine state
await working_memory.set_state(agent_id, "EXECUTING")
state = await working_memory.get_state(agent_id)

# Redis Stream for real-time events (SSE)
await working_memory.publish_event(project_id, "agent_message", data)
```

## Mailbox Pattern

```python
# Send message to agent
mailbox_key = org_key(org_id, "mailbox", agent_id)
await redis.rpush(mailbox_key, json.dumps(message))

# Agent polls (Celery beat, 1s interval)
message = await redis.lpop(mailbox_key)
```

## Human Agent (Sprint 18A)

- Human Agent can suspend execution pending human input
- `POST /agents/{id}/respond` — resume after human provides input
- SLA enforced by Celery beat: escalate if no response within configured timeout
- State: `ACTIVE → SUSPENDED_PENDING_HUMAN → ACTIVE` or `ESCALATED`

## Observational Memory (Sprint 14)

- Async Observer watches long conversations
- Celery compression task runs periodically
- Compresses old context into summary, preserves key decisions
- Reduces token usage for long-running projects

## Key Redis Key Patterns

All Redis keys MUST use `org_key()` from `security/redis_tenant.py`:

```python
org_key(org_id, "agent", agent_id, "state")     # state machine
org_key(org_id, "agent", agent_id, "context", key)  # session context
org_key(org_id, "mailbox", agent_id)            # agent mailbox
org_key(org_id, "skill_ctx", agent_id, hash)    # cached skills envelope

# Kill switch keys (global — not org-scoped by design)
"killswitch:platform:all"
"killswitch:org:{org_id}"
"killswitch:agent:{agent_id}"
"killswitch:skill:{skill_id}"
```
