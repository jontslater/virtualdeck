#!/usr/bin/env node
/**
 * Git-tracked paths under extra/raven to preserve when clearing stale stage output.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const FALLBACK_KEEP_REL = ['README.md', 'env.defaults'];

function normalizeKeepRel(rel) {
  return String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function getExtraRavenKeepRelPaths(repoRoot) {
  const root = path.resolve(repoRoot || process.cwd());
  try {
    const out = execSync('git ls-files -- extra/raven', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const rels = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => normalizeKeepRel(line.replace(/^extra\/raven\//, '')))
      .filter(Boolean);
    if (rels.length > 0) {
      return rels;
    }
  } catch {
    // not a git checkout or git unavailable
  }
  return [...FALLBACK_KEEP_REL];
}

function getProtectedTopLevelNames(keepRelPaths) {
  const names = new Set();
  for (const rel of keepRelPaths || []) {
    const norm = normalizeKeepRel(rel);
    const top = norm.split('/')[0];
    if (top) {
      names.add(top.toLowerCase());
    }
  }
  return names;
}

/**
 * Top-level stage entries to remove (stale generated output).
 */
function listStaleTopLevelStageEntries(stageDir, keepRelPaths) {
  if (!stageDir || !fs.existsSync(stageDir)) {
    return [];
  }
  const protectedNames = getProtectedTopLevelNames(keepRelPaths);
  return fs
    .readdirSync(stageDir)
    .filter((name) => !protectedNames.has(name.toLowerCase()));
}

function assertExtraRavenStageDir(stageDir, repoRoot) {
  const expected = path.resolve(repoRoot, 'extra', 'raven');
  const actual = path.resolve(stageDir);
  if (actual !== expected) {
    throw new Error(`Refusing to clean outside extra/raven: ${actual} (expected ${expected})`);
  }
}

function assertCleanStagePrereq(stageDir, repoRoot) {
  assertExtraRavenStageDir(stageDir, repoRoot);
  const keep = getExtraRavenKeepRelPaths(repoRoot);
  const stale = listStaleTopLevelStageEntries(stageDir, keep);
  if (stale.length > 0) {
    throw new Error(
      `extra/raven is not clean before staging (remove stale output first): ${stale.join(', ')}`,
    );
  }
}

function main() {
  const [cmd, arg1] = process.argv.slice(2);
  if (cmd === 'list-keep-paths') {
    const repoRoot = arg1 || process.cwd();
    for (const rel of getExtraRavenKeepRelPaths(repoRoot)) {
      process.stdout.write(`${rel}\n`);
    }
    return;
  }
  if (cmd === 'assert-clean') {
    const stageDir = arg1;
    // argv: [node, script, cmd, stageDir, repoRoot] (matches stage-raven-runtime.ps1)
    const repoRoot = process.argv[4] || path.resolve(stageDir, '..', '..');
    try {
      assertCleanStagePrereq(stageDir, repoRoot);
    } catch (err) {
      console.error(err.message || err);
      process.exit(1);
    }
    return;
  }
  if (cmd === 'list-stale-top-level') {
    const stageDir = arg1;
    // argv: [node, script, cmd, stageDir, repoRoot] (matches stage-raven-runtime.ps1)
    const repoRoot = process.argv[4] || path.resolve(stageDir, '..', '..');
    assertExtraRavenStageDir(stageDir, repoRoot);
    const keep = getExtraRavenKeepRelPaths(repoRoot);
    for (const name of listStaleTopLevelStageEntries(stageDir, keep)) {
      process.stdout.write(`${name}\n`);
    }
    return;
  }
  console.error('Usage: extra-raven-keep-paths.js list-keep-paths <repoRoot>');
  console.error('       extra-raven-keep-paths.js list-stale-top-level <stageDir> [repoRoot]\n       extra-raven-keep-paths.js assert-clean <stageDir> [repoRoot]');
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = {
  FALLBACK_KEEP_REL,
  normalizeKeepRel,
  getExtraRavenKeepRelPaths,
  getProtectedTopLevelNames,
  listStaleTopLevelStageEntries,
  assertExtraRavenStageDir,
  assertCleanStagePrereq,
};
