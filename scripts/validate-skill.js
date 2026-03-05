#!/usr/bin/env node
/**
 * validate-skill.js — EnGenAI SKILL.md validator (Gate 1 + Gate 2 schema check)
 *
 * Usage:
 *   node scripts/validate-skill.js skills/development/code-review.SKILL.md
 *   node scripts/validate-skill.js --strict skills/development/code-review.SKILL.md
 *
 * Exits 0 if valid, 1 if invalid.
 */

'use strict'

const fs = require('fs')
const path = require('path')

const STRICT = process.argv.includes('--strict')
const files = process.argv.slice(2).filter(a => !a.startsWith('--'))

if (files.length === 0) {
  console.error('Usage: validate-skill.js [--strict] <skill-file.SKILL.md> ...')
  process.exit(1)
}

// ── Required frontmatter fields ──────────────────────────────────────────────

const REQUIRED_TOP = ['name', 'version', 'description', 'engenai', 'author', 'license', 'updated', 'safety_constraints']
const REQUIRED_ENGENAI = ['category', 'trust_tier', 'risk_level', 'capabilities_required', 'allowed_domains']
const VALID_CATEGORIES = ['development', 'devops', 'security', 'documentation', 'research', 'integrations', 'context']
const VALID_TRUST_TIERS = ['official', 'verified_partner', 'community_vetted', 'unvetted']
const VALID_RISK_LEVELS = ['low', 'medium', 'high']

// ── Forbidden patterns (Gate 2) ───────────────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  { pattern: /<\/skills_context>/i, name: 'XML envelope escape' },
  { pattern: /<platform_policy/i, name: 'Policy Puppetry' },
  { pattern: /ignore\s+(all\s+)?(previous\s+)?instructions/i, name: 'direct override' },
  { pattern: /you\s+are\s+now\s+(a|an)\s/i, name: 'identity replacement' },
  { pattern: /your\s+true\s+purpose/i, name: 'identity replacement' },
  { pattern: /<\|im_start\|>/i, name: 'ChatML injection' },
  { pattern: /<\|system\|>/i, name: 'Llama template injection' },
  { pattern: /###\s*instruction/i, name: 'Alpaca template injection' },
  { pattern: /[\u200B\u200C\u200D\uFEFF\u202A-\u202E]/, name: 'invisible Unicode' },
  { pattern: /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AIza[A-Za-z0-9_-]{35}|AKIA[A-Za-z0-9]{16})/, name: 'hardcoded credential' },
]

// ── SKILL.md parser ───────────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const parts = content.split('---')
  if (parts.length < 3) return null

  // Simple YAML key extractor (handles nested via indentation)
  const yaml = parts[1].trim()
  const result = {}

  const lines = yaml.split('\n')
  let currentSection = null
  let currentSubSection = null

  for (const line of lines) {
    const topMatch = line.match(/^(\w+):\s*(.*)/)
    const nestedMatch = line.match(/^  (\w+):\s*(.*)/)
    const deepMatch = line.match(/^    (\w+):\s*(.*)/)

    if (topMatch && !line.startsWith(' ')) {
      const [, key, val] = topMatch
      if (val.trim() === '' || val.trim() === '|') {
        result[key] = {}
        currentSection = key
        currentSubSection = null
      } else {
        result[key] = val.trim().replace(/^["']|["']$/g, '')
        currentSection = null
      }
    } else if (nestedMatch && currentSection) {
      const [, key, val] = nestedMatch
      if (typeof result[currentSection] !== 'object') result[currentSection] = {}
      if (val.trim() === '' || val.trim() === '|') {
        result[currentSection][key] = {}
        currentSubSection = key
      } else {
        result[currentSection][key] = val.trim().replace(/^["']|["']$/g, '')
      }
    } else if (deepMatch && currentSection && currentSubSection) {
      const [, key, val] = deepMatch
      if (typeof result[currentSection][currentSubSection] !== 'object') {
        result[currentSection][currentSubSection] = {}
      }
      result[currentSection][currentSubSection][key] = val.trim().replace(/^["']|["']$/g, '')
    }
  }

  return { frontmatter: result, body: parts.slice(2).join('---') }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateSkill(filePath) {
  const errors = []
  const warnings = []

  if (!filePath.endsWith('.SKILL.md')) {
    errors.push('File must end in .SKILL.md')
    return { errors, warnings }
  }

  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parseFrontmatter(content)

  if (!parsed) {
    errors.push('Could not parse frontmatter — ensure file starts with ---')
    return { errors, warnings }
  }

  const { frontmatter: fm, body } = parsed

  // Required top-level fields
  for (const field of REQUIRED_TOP) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // engenai section
  if (fm.engenai && typeof fm.engenai === 'object') {
    for (const field of REQUIRED_ENGENAI) {
      if (fm.engenai[field] === undefined) {
        errors.push(`Missing required engenai.${field}`)
      }
    }
    if (fm.engenai.category && !VALID_CATEGORIES.includes(fm.engenai.category)) {
      errors.push(`Invalid category: ${fm.engenai.category}. Must be one of: ${VALID_CATEGORIES.join(', ')}`)
    }
    if (fm.engenai.trust_tier && !VALID_TRUST_TIERS.includes(fm.engenai.trust_tier)) {
      errors.push(`Invalid trust_tier: ${fm.engenai.trust_tier}`)
    }
    if (fm.engenai.risk_level && !VALID_RISK_LEVELS.includes(fm.engenai.risk_level)) {
      errors.push(`Invalid risk_level: ${fm.engenai.risk_level}`)
    }
  }

  // Name matches filename
  const expectedName = path.basename(filePath, '.SKILL.md')
  if (fm.name && fm.name !== expectedName) {
    errors.push(`name field "${fm.name}" does not match filename "${expectedName}"`)
  }

  // Version format (semver)
  if (fm.version && !/^\d+\.\d+\.\d+$/.test(fm.version)) {
    errors.push(`version must be semver (e.g. 1.0.0), got: ${fm.version}`)
  }

  // Forbidden patterns (run on full content including body)
  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    // Allow patterns inside fenced code blocks (they're examples, not live content)
    const contentWithoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '')
    if (pattern.test(contentWithoutCodeBlocks)) {
      errors.push(`Forbidden pattern detected: ${name}`)
    }
  }

  // Strict mode: warn on missing optional fields
  if (STRICT) {
    if (!fm.tags || fm.tags === '') warnings.push('Consider adding tags for search discoverability')
    if (!fm.parameters) warnings.push('No parameters defined — add if skill accepts inputs')
  }

  return { errors, warnings }
}

// ── Main ──────────────────────────────────────────────────────────────────────

let totalErrors = 0

for (const file of files) {
  const { errors, warnings } = validateSkill(file)

  if (errors.length === 0) {
    console.log(`✓ ${file}`)
  } else {
    console.error(`✗ ${file}`)
    for (const e of errors) console.error(`  ERROR: ${e}`)
    totalErrors += errors.length
  }

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`  WARN:  ${w}`)
  }
}

if (totalErrors > 0) {
  console.error(`\n${totalErrors} error(s) found. Fix before merging.`)
  process.exit(1)
}

console.log(`\nAll ${files.length} skill(s) valid.`)
process.exit(0)
