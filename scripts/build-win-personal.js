#!/usr/bin/env node
/**
 * Personal Windows installer build: always restores extra/raven/env.defaults in finally.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    const err = new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
    err.exitCode = result.status || 1;
    throw err;
  }
}

function restoreEnvDefaults() {
  const result = spawnSync('node', [path.join(__dirname, 'restore-raven-env-defaults.js')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error('Warning: restore-raven-env-defaults exited with', result.status);
  }
}

let failed = false;
try {
  run('npm', ['run', 'stage-raven:personal']);
  process.env.RAVEN_BUNDLE_KEYS = '1';
  require(path.join(repoRoot, 'prepare-build')).runPrepareBuild();
  run('npx', ['electron-builder', '--win']);
} catch (err) {
  failed = true;
  console.error(err.message || err);
} finally {
  restoreEnvDefaults();
}

process.exitCode = failed ? 1 : 0;
