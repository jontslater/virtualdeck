#!/usr/bin/env node
/**
 * Exit 0 if a module resolves from a directory search path.
 * Usage: node resolve-module.js <cwd> <moduleName>
 */
const path = require('path');

const cwd = process.argv[2];
const mod = process.argv[3];
if (!cwd || !mod) {
  console.error('Usage: node resolve-module.js <cwd> <moduleName>');
  process.exit(1);
}

const search = [
  cwd,
  path.join(cwd, '..'),
  path.join(cwd, '..', '..'),
  path.join(cwd, '..', '..', '..'),
  path.join(cwd, '..', '..', '..', '..'),
];

function tryResolve(spec) {
  try {
    require.resolve(spec, { paths: search });
    return true;
  } catch (e) {
    if (e && e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return true;
    return false;
  }
}

if (mod.startsWith('@types/')) {
  process.exit(0);
}

if (tryResolve(`${mod}/package.json`) || tryResolve(mod)) {
  process.exit(0);
}
process.exit(2);
