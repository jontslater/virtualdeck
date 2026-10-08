#!/usr/bin/env node
/**
 * Restore committed extra/raven/env.defaults after a personal (key-bundled) build.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const envDefaults = path.join(repoRoot, 'extra', 'raven', 'env.defaults');
const backup = path.join(repoRoot, 'extra', 'raven', '.env.defaults.template.backup');
const seed = path.join(__dirname, 'raven-env.defaults.template');

if (fs.existsSync(backup)) {
  fs.copyFileSync(backup, envDefaults);
  console.log('Restored extra/raven/env.defaults from .env.defaults.template.backup');
  process.exit(0);
}

try {
  execSync('git checkout -- extra/raven/env.defaults', { cwd: repoRoot, stdio: 'pipe' });
  console.log('Restored extra/raven/env.defaults from git');
  process.exit(0);
} catch {
  // fall through
}

if (fs.existsSync(seed)) {
  fs.copyFileSync(seed, envDefaults);
  console.log('Restored extra/raven/env.defaults from scripts/raven-env.defaults.template');
  process.exit(0);
}

console.warn('Could not restore extra/raven/env.defaults (no backup, git, or seed template).');
process.exit(1);
