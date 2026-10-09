#!/usr/bin/env node
/**
 * Recursive delete safe for long paths; does not follow directory junctions/symlinks.
 */
const fs = require('fs');
const path = require('path');

function assertUnderExtraRaven(targetPath, repoRoot) {
  const stageDir = path.resolve(repoRoot, 'extra', 'raven');
  const target = path.resolve(targetPath);
  if (target === stageDir || target.startsWith(`${stageDir}${path.sep}`)) {
    return;
  }
  throw new Error(`Refusing to delete outside extra/raven: ${target}`);
}

function rmPathRecursive(targetPath, options = {}) {
  const target = path.resolve(targetPath);
  if (options.repoRoot) {
    assertUnderExtraRaven(target, options.repoRoot);
  }
  if (!fs.existsSync(target)) {
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
  if (fs.existsSync(target)) {
    throw new Error(`Path still exists after rmSync: ${target}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const target = args[0];
  let repoRoot = null;
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === '--repo-root' && args[i + 1]) {
      repoRoot = args[i + 1];
      i += 1;
    }
  }
  if (!target) {
    console.error('Usage: rm-path-recursive.js <path> [--repo-root <repoRoot>]');
    process.exit(2);
  }
  try {
    rmPathRecursive(target, { repoRoot });
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  rmPathRecursive,
  assertUnderExtraRaven,
};
