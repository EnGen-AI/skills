# Contributing to EnGenAI Skills Marketplace

Thank you for your interest in contributing! This guide explains how to submit skills, what format to use, and how the review process works.

## Ways to Contribute

### 1. Submit a New Skill (Pull Request)

1. Fork this repository
2. Create a new folder under the appropriate category (`skills/development/`, `skills/devops/`, etc.)
3. Add your skill file (`your-skill-name.SKILL.md` or `skill.yaml`)
4. Open a pull request against `main`

### 2. Submit via the EnGenAI Platform

If you're an EnGenAI Platform user:

1. Go to **Skills Management** in the admin panel
2. Click **Add Skills**
3. Paste your GitHub repo URL or enter your skill content directly
4. The platform will parse, vet, and queue your skill for review

### 3. Improve Existing Skills

- Fix bugs in skill prompts or code
- Improve instructions for clarity
- Add missing test cases or examples
- Update dependencies or prerequisites

### 4. Report Issues

Found a skill that doesn't work? [Open an issue](https://github.com/EnGen-AI/skills/issues) with:
- Which skill has the problem
- What you expected vs what happened
- Your agent/platform version

## Skill Format

Every skill must follow the [SKILL_FORMAT.md](spec/SKILL_FORMAT.md) specification.

### Minimum Required Fields

```yaml
---
name: your-skill-name          # Lowercase, hyphenated
version: 1.0.0                 # Semantic versioning
description: What the skill does
author: Your Name
skill_type: steering | tool | hybrid
category: development | devops | security | context | documentation | research | integrations
tags: [tag1, tag2]
default_permission: allow | ask | deny
---

## Instructions

Your skill content here...
```

### Skill Types

| Type | When to Use | Content |
|------|------------|---------|
| `steering` | Shapes agent behavior | Markdown instructions only |
| `tool` | Runs executable code | Python code with `function_name` |
| `hybrid` | Both | Instructions + executable code |

### File Naming

- Use lowercase with hyphens: `code-review.SKILL.md`
- Place in the correct category folder: `skills/development/code-review.SKILL.md`
- One skill per file

### Attribution Fields (Optional but Encouraged)

```yaml
attribution_author: Original Author Name
attribution_url: https://github.com/original-author/repo
attribution_notes: Based on the XYZ methodology by Author Name
```

## Review Process

```
Your PR ──→ CI Lint Check ──→ Security Scan ──→ Maintainer Review ──→ Merge
                │                   │                    │
                ▼                   ▼                    ▼
          Format valid?      No dangerous       Quality check:
          Fields present?    patterns found?     - Clear instructions
          YAML parses?       No credential       - Tested examples
                             leaks?              - Proper attribution
```

### What We Check

1. **Format** — Valid YAML frontmatter, required fields present
2. **Security** — No prompt injection patterns, no credential harvesting, no dangerous imports
3. **Quality** — Clear description, useful instructions, working examples
4. **Attribution** — Original authors credited if building on existing work

### Timeline

- **Automated checks**: Run immediately on PR
- **Human review**: Typically within 48 hours
- **Feedback**: We'll comment on the PR if changes are needed

## Licensing

By contributing to this repository, you agree that your contributions are licensed under **CC-BY-4.0** (Creative Commons Attribution 4.0 International).

This means:
- You retain credit as the original author
- Others can use, share, and adapt your skill
- Attribution must be given when your skill is used
- You can still use your own skill however you want

## Code of Conduct

- Be respectful and constructive in reviews and discussions
- Give credit where credit is due
- Don't submit skills that could harm users or systems
- Report security issues responsibly

## Questions?

- [Open an issue](https://github.com/EnGen-AI/skills/issues) for questions about the format or process
- Visit [engenai.app](https://engenai.app) to learn more about the platform

---

**Thank you for helping build the EnGenAI Skills Marketplace!**
