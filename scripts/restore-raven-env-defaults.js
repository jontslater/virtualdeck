#!/usr/bin/env node
/**
 * Restore committed extra/raven/env.defaults after a personal (key-bundled) build.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const repoRoot = path.join(__dirname, '..');
const envDefaults = path.join(repoRoot, 'extra', 'raven', 'env.defaults');
const pointerFile = path.join(__dirname, '.raven-env-defaults-backup-path');
const seed = path.join(__dirname, 'raven-env.defaults.template');
const { stripBom } = require('./raven-staging/read-utf8');

function readBackupPath() {
  if (process.env.RAVEN_ENV_DEFAULTS_BACKUP && fs.existsSync(process.env.RAVEN_ENV_DEFAULTS_BACKUP)) {
    return process.env.RAVEN_ENV_DEFAULTS_BACKUP;
  }
  if (fs.existsSync(pointerFile)) {
    const p = stripBom(fs.readFileSync(pointerFile, 'utf8')).trim();
    if (p && fs.existsSync(p)) return p;
  }
  const tempDefault = path.join(os.tmpdir(), 'virtualdeck-raven-env-backup', 'env.defaults.template');
  if (fs.existsSync(tempDefault)) return tempDefault;
  return null;
}

const backup = readBackupPath();
if (backup) {
  fs.copyFileSync(backup, envDefaults);
  console.log('Restored extra/raven/env.defaults from temp backup');
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
