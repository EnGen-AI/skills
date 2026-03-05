#!/usr/bin/env python3
"""
security-scan.py — Gate 2 injection pattern scan for SKILL.md files.

Uses the same regex patterns as the platform's skill_sanitiser.py to ensure
skills that pass CI also pass runtime injection checks.

Usage:
    python scripts/security-scan.py skills/development/code-review.SKILL.md
    echo $?  # 0 = clean, 1 = blocked
"""

import re
import sys
import textwrap
from pathlib import Path

# ── Injection patterns (must mirror security/skill_sanitiser.py) ──────────────

BLOCKED_PATTERNS = [
    (re.compile(r"</skills_context>", re.IGNORECASE), "XML envelope escape"),
    (re.compile(r"<platform_policy", re.IGNORECASE), "Policy Puppetry"),
    (re.compile(r"ignore\s+(all\s+)?(previous\s+)?instructions", re.IGNORECASE), "direct override"),
    (re.compile(r"you\s+are\s+now\s+(a|an)\s", re.IGNORECASE), "identity replacement"),
    (re.compile(r"your\s+true\s+purpose", re.IGNORECASE), "identity replacement"),
    (re.compile(r"<\|im_start\|>", re.IGNORECASE), "ChatML injection"),
    (re.compile(r"<\|system\|>", re.IGNORECASE), "Llama template injection"),
    (re.compile(r"###\s*instruction", re.IGNORECASE), "Alpaca template injection"),
    (re.compile(r"[\u200b\u200c\u200d\ufeff\u202a-\u202e]"), "invisible Unicode"),
    (
        re.compile(r"(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AIza[A-Za-z0-9_-]{35}|AKIA[A-Za-z0-9]{16})"),
        "hardcoded credential",
    ),
]

CODE_FENCE_RE = re.compile(r"```[\s\S]*?```", re.MULTILINE)


def strip_code_fences(content: str) -> str:
    """Remove fenced code blocks — patterns inside examples are acceptable."""
    return CODE_FENCE_RE.sub("", content)


def scan_file(file_path: str) -> list[tuple[str, str]]:
    """Return list of (pattern_name, matched_text) violations."""
    content = Path(file_path).read_text(encoding="utf-8")
    clean = strip_code_fences(content)
    violations = []
    for pattern, name in BLOCKED_PATTERNS:
        match = pattern.search(clean)
        if match:
            violations.append((name, match.group(0)[:50]))
    return violations


def main() -> int:
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not files:
        print("Usage: security-scan.py <skill-file.SKILL.md> ...", file=sys.stderr)
        return 1

    total_violations = 0
    for file_path in files:
        violations = scan_file(file_path)
        if not violations:
            print(f"CLEAN  {file_path}")
        else:
            print(f"BLOCK  {file_path}")
            for name, snippet in violations:
                print(f"  [{name}] matched: {snippet!r}")
            total_violations += len(violations)

    if total_violations:
        print(f"\n{total_violations} violation(s) found. Skill blocked at Gate 2.")
        return 1

    print(f"\nAll {len(files)} skill(s) passed security scan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
