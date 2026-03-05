#!/usr/bin/env node
/**
 * update-hash.js — Update content_hash field in a SKILL.md frontmatter
 * Called by skill-publish.yml CI after computing the hash.
 *
 * Usage:
 *   node scripts/update-hash.js skills/development/code-review.SKILL.md <sha256>
 */

'use strict'

const fs = require('fs')
const [,, filePath, hash] = process.argv

if (!filePath || !hash) {
  console.error('Usage: update-hash.js <skill-file.SKILL.md> <sha256-hash>')
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf8')
content = content.replace(
  /^(\s*content_hash:\s*)"[^"]*"/m,
  `$1"${hash}"`
)
fs.writeFileSync(filePath, content)
console.log(`Updated content_hash in ${filePath}`)
