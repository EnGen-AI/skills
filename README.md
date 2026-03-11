# EnGenAI Skills Marketplace

**Open-source skills for AI agents — build, share, and collaborate.**

EnGenAI Skills Marketplace is a community-driven repository of vetted, reusable skills that extend AI agent capabilities on the [EnGenAI Platform](https://engenai.app). Skills are modular instruction sets that teach agents new abilities — from code review to infrastructure deployment.

---

## What Is a Skill?

A **skill** is a structured YAML file (`skill.yaml` or `SKILL.md`) that defines:

- **What** the agent can do (description, capabilities)
- **How** it does it (prompt additions, code, tool bindings)
- **When** it activates (workflow phases, triggers)
- **Who** created it (attribution, license)

Skills come in three types:

| Type | Purpose | Example |
|------|---------|---------|
| **Steering** | Shapes agent behavior via prompt injection | `code-review.SKILL.md` |
| **Tool** | Executable Python code in a sandbox | `api-test.SKILL.md` |
| **Hybrid** | Both steering and executable code | `tdd-workflow.SKILL.md` |

## Skill Categories

| Category | Description | Count |
|----------|-------------|-------|
| `context/` | Project and workspace awareness | 6 |
| `development/` | Code writing, review, testing | 7 |
| `devops/` | Deployment, infrastructure, CI/CD | 5 |
| `security/` | Auditing, scanning, incident response | 5 |

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    SKILLS LIFECYCLE                           │
│                                                              │
│  1. CONTRIBUTE  ──  Author writes a skill.yaml               │
│  2. SUBMIT      ──  PR to this repo (or sync via platform)   │
│  3. VET         ──  Automated security scan + sandbox test    │
│  4. REVIEW      ──  Platform admin reviews in Pending tab     │
│  5. APPROVE     ──  Skill moves to Approved, available to     │
│                     agents in the workbench                   │
│  6. ATTRIBUTE   ──  Original author credited (CC-BY-4.0)     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### For Platform Users

1. Open the **Skills Management** page in the EnGenAI admin panel
2. Click **Add Skills** and enter this repo URL (or any public GitHub repo with skills)
3. Skills are synced to the **Pending** tab for review
4. Review vetting reports, edit if needed, then **Approve** or **Reject**
5. Approved skills appear in the **Workbench** for agents to use

### For External Repos

You can sync skills from **any public GitHub repository** — not just this one. For example:

```
https://github.com/coreyhaines31/marketingskills
```

The platform will walk the repo, find all `skill.yaml` / `SKILL.md` files, parse them, and import them to your Pending queue. **The original author is always credited** via the attribution fields.

## Skill Format

Every skill follows the [SKILL_FORMAT.md](spec/SKILL_FORMAT.md) specification. Here's a minimal example:

```yaml
---
name: code-review
version: 1.0.0
description: Reviews code for bugs, security issues, and best practices
author: EnGenAI Team
skill_type: steering
category: development
trust_tier: official
tags: [code-review, quality, security]
default_permission: allow
---

## Instructions

When asked to review code, follow these steps:
1. Check for security vulnerabilities (OWASP Top 10)
2. Identify logic errors and edge cases
3. Suggest improvements for readability and performance
4. Verify test coverage for changed code
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Ways to contribute:**
- Submit new skills via pull request
- Improve existing skills (bug fixes, better prompts)
- Report issues with skills that don't work as expected
- Suggest new skill categories

All contributions are licensed under **CC-BY-4.0** — you retain credit as the original author, and the community can build on your work.

## Attribution

This project uses the **Creative Commons Attribution 4.0 International** license. When we pull skills from external repositories, we:

1. **Credit the original author** in the skill's `attribution_author` field
2. **Link back** to the source repository in `attribution_url`
3. **Preserve** any additional license notes in `attribution_notes`

If you see your work here without proper credit, please [open an issue](https://github.com/EnGen-AI/skills/issues) and we'll fix it immediately.

## Security

Every skill goes through a multi-gate security pipeline before it reaches an agent:

1. **Static Analysis** — Pattern matching for prompt injection, credential leaks, dangerous imports
2. **Sandbox Testing** — Isolated execution with restricted syscalls and network
3. **Expert Review** — Human approval required for community-submitted skills
4. **Runtime Envelope** — Hermetic XML boundary prevents skills from overriding system prompts

See [SKILL_FORMAT.md](spec/SKILL_FORMAT.md) for the full vetting specification.

## License

This repository is licensed under [CC-BY-4.0](LICENSE) (Creative Commons Attribution 4.0 International).

You are free to:
- **Share** — copy and redistribute skills in any format
- **Adapt** — remix, transform, and build upon skills for any purpose

Under the following terms:
- **Attribution** — You must give appropriate credit to the original author

---

**EnGenAI — The Machine That Builds Machines**

[engenai.app](https://engenai.app) | [Platform Repo](https://github.com/engenai-platform/engenai)
