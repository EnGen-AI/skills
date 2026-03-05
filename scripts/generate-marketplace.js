#!/usr/bin/env node
/**
 * generate-marketplace.js — Auto-generate .claude-plugin/marketplace.json
 *
 * Scans all skills/**\/*.SKILL.md files, extracts frontmatter, and generates
 * a Claude Code plugin source manifest.
 *
 * Usage:
 *   node scripts/generate-marketplace.js
 *   node scripts/generate-marketplace.js --dry-run  (print, do not write)
 *
 * Output: .claude-plugin/marketplace.json
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DRY_RUN = process.argv.includes('--dry-run')

// ── Frontmatter parser (minimal) ──────────────────────────────────────────────

function parseSimpleFrontmatter(content) {
  const parts = content.split('---')
  if (parts.length < 3) return null

  const yaml = parts[1].trim()
  const body = parts.slice(2).join('---').trim()
  const fm = {}

  // Extract top-level fields
  const nameMatch = yaml.match(/^name:\s*(.+)$/m)
  const versionMatch = yaml.match(/^version:\s*(.+)$/m)
  const descMatch = yaml.match(/^description:\s*\|?\s*\n([\s\S]*?)(?=\n\w|\nengenai:)/m)
  const authorMatch = yaml.match(/^author:\s*(.+)$/m)
  const licenseMatch = yaml.match(/^license:\s*(.+)$/m)
  const updatedMatch = yaml.match(/^updated:\s*(.+)$/m)
  const tagsMatch = yaml.match(/^tags:\s*\[([^\]]*)\]/m)

  // Extract engenai section
  const engenaiMatch = yaml.match(/^engenai:\n([\s\S]*?)(?=\n\w|\n$)/m)
  const engenaiBlock = engenaiMatch ? engenaiMatch[1] : ''

  const categoryMatch = engenaiBlock.match(/category:\s*(.+)/)
  const trustTierMatch = engenaiBlock.match(/trust_tier:\s*(.+)/)
  const riskLevelMatch = engenaiBlock.match(/risk_level:\s*(.+)/)
  const contentHashMatch = engenaiBlock.match(/content_hash:\s*"?([^"\n]*)"?/)
  const signedByMatch = engenaiBlock.match(/signed_by:\s*"?([^"\n]*)"?/)

  // Parse capabilities_required list
  const capsMatch = engenaiBlock.match(/capabilities_required:\s*\n((?:\s+-\s+.+\n?)*)/m)
  const capabilities = capsMatch
    ? capsMatch[1].trim().split('\n').map(l => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean)
    : []

  fm.name = nameMatch ? nameMatch[1].trim() : null
  fm.version = versionMatch ? versionMatch[1].trim() : null
  fm.description = descMatch ? descMatch[1].trim().replace(/\n\s+/g, ' ') : ''
  fm.author = authorMatch ? authorMatch[1].trim() : null
  fm.license = licenseMatch ? licenseMatch[1].trim() : null
  fm.updated = updatedMatch ? updatedMatch[1].trim() : null
  fm.tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : []
  fm.category = categoryMatch ? categoryMatch[1].trim() : null
  fm.trust_tier = trustTierMatch ? trustTierMatch[1].trim() : null
  fm.risk_level = riskLevelMatch ? riskLevelMatch[1].trim() : null
  fm.content_hash = contentHashMatch ? contentHashMatch[1].trim() : ''
  fm.signed_by = signedByMatch ? signedByMatch[1].trim() : ''
  fm.capabilities_required = capabilities

  return { frontmatter: fm, body }
}

// ── Compute content hash ──────────────────────────────────────────────────────

function computeHash(body) {
  return crypto.createHash('sha256').update(body, 'utf8').digest('hex')
}

// ── Scan skills directory ─────────────────────────────────────────────────────

function findSkillFiles(dir) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findSkillFiles(full))
    } else if (entry.name.endsWith('.SKILL.md')) {
      results.push(full)
    }
  }
  return results.sort()
}

// ── Main ──────────────────────────────────────────────────────────────────────

const skillsDir = path.join(__dirname, '..', 'skills')
const outputPath = path.join(__dirname, '..', '.claude-plugin', 'marketplace.json')

const skillFiles = findSkillFiles(skillsDir)
const skills = []

for (const filePath of skillFiles) {
  const content = fs.readFileSync(filePath, 'utf8')
  const parsed = parseSimpleFrontmatter(content)

  if (!parsed || !parsed.frontmatter.name) {
    console.warn(`WARN: Could not parse ${filePath} — skipping`)
    continue
  }

  const { frontmatter: fm, body } = parsed
  const computedHash = computeHash(body)

  // Verify stored hash matches computed (if a hash is stored)
  if (fm.content_hash && fm.content_hash !== computedHash) {
    console.error(`ERROR: Hash mismatch for ${filePath}`)
    console.error(`  Stored:   ${fm.content_hash}`)
    console.error(`  Computed: ${computedHash}`)
    process.exit(1)
  }

  const relativePath = path.relative(path.join(__dirname, '..'), filePath)

  skills.push({
    name: fm.name,
    version: fm.version,
    description: fm.description,
    category: fm.category,
    trust_tier: fm.trust_tier,
    risk_level: fm.risk_level,
    capabilities_required: fm.capabilities_required,
    author: fm.author,
    license: fm.license,
    updated: fm.updated,
    tags: fm.tags,
    content_hash: computedHash,
    signed_by: fm.signed_by || '',
    file: relativePath,
  })
}

const manifest = {
  name: 'EnGenAI Skills Marketplace',
  description: 'Vetted, open-source skills for AI agents built on EnGenAI',
  version: '1.0.0',
  source: 'https://github.com/engenai-platform/engenai-skills',
  generated_at: new Date().toISOString(),
  skills,
}

const output = JSON.stringify(manifest, null, 2)

if (DRY_RUN) {
  console.log(output)
  console.log(`\nDry run: ${skills.length} skill(s) would be published.`)
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, output + '\n')
  console.log(`Generated marketplace.json with ${skills.length} skill(s).`)
}
