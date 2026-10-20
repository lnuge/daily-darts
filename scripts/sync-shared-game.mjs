#!/usr/bin/env node
/**
 * Copies the pure game logic from src/game into supabase/functions/_shared/game,
 * so edge functions replay rounds with exactly the code the browser runs.
 *
 *   npm run sync:game          write the copies
 *   npm run sync:game -- --check   exit 1 if the copies are out of date (used by npm test)
 *
 * Tests and test helpers aren't copied. Every copied file must import only
 * other files in src/game, with explicit `.ts` extensions (Deno needs them).
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src', 'game')
const DEST = join(ROOT, 'supabase', 'functions', '_shared', 'game')

const header = (file) =>
  `// GENERATED from src/game/${file} by scripts/sync-shared-game.mjs. Do not edit.\n` +
  `// Change src/game/${file}, then run: npm run sync:game\n\n`

const isShared = (file) =>
  file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== 'test-helpers.ts'

/** Problems that would stop a file working on the server. */
function importProblems(file, source) {
  const problems = []
  for (const [, spec] of source.matchAll(/from\s+'([^']+)'/g)) {
    if (!spec.startsWith('./')) {
      problems.push(`${file}: imports '${spec}'; shared game code may only import from src/game`)
    } else if (!spec.endsWith('.ts')) {
      problems.push(`${file}: imports '${spec}' without the .ts extension Deno needs`)
    }
  }
  return problems
}

/** What DEST should contain: file name → contents. */
function expectedFiles() {
  const files = new Map()
  const problems = []
  for (const file of readdirSync(SRC).filter(isShared).sort()) {
    const source = readFileSync(join(SRC, file), 'utf8')
    problems.push(...importProblems(file, source))
    files.set(file, header(file) + source)
  }
  return { files, problems }
}

function currentFiles() {
  try {
    return new Map(readdirSync(DEST).map((file) => [file, readFileSync(join(DEST, file), 'utf8')]))
  } catch {
    return new Map()
  }
}

const { files, problems } = expectedFiles()
if (problems.length) {
  console.error('Cannot share src/game with the server:\n  ' + problems.join('\n  '))
  process.exit(1)
}

const current = currentFiles()
const stale = [
  ...[...files].filter(([file, text]) => current.get(file) !== text).map(([file]) => file),
  ...[...current.keys()].filter((file) => !files.has(file)),
]

if (process.argv.includes('--check')) {
  if (stale.length) {
    console.error(
      `supabase/functions/_shared/game is out of date (${stale.join(', ')}).\n` +
        'Run: npm run sync:game',
    )
    process.exit(1)
  }
  console.log(`Shared game code is up to date (${files.size} files).`)
} else {
  mkdirSync(DEST, { recursive: true })
  for (const file of current.keys()) if (!files.has(file)) rmSync(join(DEST, file))
  for (const [file, text] of files) writeFileSync(join(DEST, file), text)
  console.log(
    `Synced ${files.size} files to supabase/functions/_shared/game` +
      (stale.length ? ` (updated: ${stale.join(', ')})` : ' (no changes)'),
  )
}
