#!/usr/bin/env node
/**
 * Verify staged Raven app layout: controller deps resolve, no broken symlinks under app/.
 * Usage: node verify-staged-layout.js <stagedAppRoot>
 */
const fs = require('fs');
const path = require('path');
const { readFileUtf8 } = require('./read-utf8');

const appRoot = process.argv[2];
if (!appRoot) {
  console.error('Usage: node verify-staged-layout.js <stagedAppRoot>');
  process.exit(1);
}

const controllerDir = path.join(appRoot, 'apps', 'controller');
const pkgPath = path.join(controllerDir, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('missing controller package.json at', pkgPath);
  process.exit(10);
}

const pkg = JSON.parse(readFileUtf8(pkgPath));
const deps = Object.assign({}, pkg.dependencies || {}, pkg.optionalDependencies || {});

function isTypesPackage(name) {
  return name.startsWith('@types/');
}

function searchPaths(baseDir) {
  return [baseDir, path.join(baseDir, 'node_modules')];
}

function depResolvable(name, spec, baseDir) {
  if (isTypesPackage(name)) return true;
  if (typeof spec === 'string' && spec.startsWith('file:')) {
    const raw = spec.slice('file:'.length);
    const target = path.resolve(baseDir, raw);
    return fs.existsSync(path.join(target, 'package.json'));
  }
  const paths = searchPaths(baseDir);
  try {
    require.resolve(`${name}/package.json`, { paths });
    return true;
  } catch (e) {
    if (e && e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return true;
  }
  try {
    require.resolve(name, { paths });
    return true;
  } catch (e2) {
    if (e2 && e2.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return true;
    return false;
  }
}

const missing = [];
for (const [name, spec] of Object.entries(deps)) {
  if (!depResolvable(name, spec, controllerDir)) {
    missing.push(name);
  }
}
if (missing.length) {
  console.error('controller missing dependencies:', missing.join(', '));
  process.exit(2);
}

const brokenLinks = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    let st;
    try {
      st = fs.lstatSync(full);
    } catch {
      brokenLinks.push(full);
      continue;
    }
    if (st.isSymbolicLink()) {
      try {
        fs.realpathSync(full);
      } catch {
        brokenLinks.push(full);
      }
      continue;
    }
    if (st.isDirectory()) {
      if (ent.name === 'node_modules' && dir !== controllerDir) {
        // still walk node_modules for dangling links (7za fails on these)
      }
      walk(full);
    }
  }
}

if (fs.existsSync(appRoot)) {
  walk(appRoot);
}

if (brokenLinks.length) {
  console.error('broken symlinks/junctions under app/:');
  for (const p of brokenLinks) {
    console.error(' ', p);
  }
  process.exit(3);
}

process.exit(0);
