#!/usr/bin/env node
/**
 * Verify apps/controller runtime dependencies are present in AITuber node_modules.
 * Usage: node test-controller-deps.js <repoRoot> <controllerDir>
 */
const fs = require('fs');
const path = require('path');

const root = process.argv[2];
const controllerDir = process.argv[3];

if (!root || !controllerDir) {
  console.error('Usage: node test-controller-deps.js <repoRoot> <controllerDir>');
  process.exit(1);
}

const pkgPath = path.join(controllerDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  process.exit(10);
}

if (!fs.existsSync(path.join(root, 'node_modules'))) {
  process.exit(11);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const deps = Object.assign({}, pkg.dependencies || {}, pkg.optionalDependencies || {});
const search = [controllerDir, root, path.join(root, 'node_modules')];

function isTypesPackage(name) {
  return name.startsWith('@types/');
}

function depInstalled(name) {
  if (isTypesPackage(name)) {
    return true;
  }
  try {
    require.resolve(`${name}/package.json`, { paths: search });
    return true;
  } catch (e) {
    if (e && e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
      return true;
    }
    try {
      require.resolve(name, { paths: search });
      return true;
    } catch (e2) {
      if (e2 && e2.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
        return true;
      }
      return false;
    }
  }
}

for (const name of Object.keys(deps)) {
  const spec = deps[name];
  if (typeof spec === 'string' && spec.startsWith('file:')) {
    continue;
  }
  if (!depInstalled(name)) {
    console.error('missing dependency:', name);
    process.exit(2);
  }
}

if (!depInstalled('@ai-streamer/shared')) {
  console.error('missing dependency: @ai-streamer/shared');
  process.exit(3);
}

process.exit(0);
