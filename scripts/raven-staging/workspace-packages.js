#!/usr/bin/env node
/**
 * Discover pnpm workspace packages and controller dependency closure for Raven staging.
 */
const fs = require('fs');
const path = require('path');
const { readFileUtf8 } = require('./read-utf8');

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.turbo',
  '.cache',
  '.ignored',
  '.pnpm',
]);

function posixRel(fromRoot, absDir) {
  return path.relative(fromRoot, absDir).split(path.sep).join('/');
}

function walkPackageDirs(rootDir, onPackageDir) {
  if (!fs.existsSync(rootDir)) return;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const pkgJson = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJson)) {
      onPackageDir(dir);
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (SKIP_DIR_NAMES.has(ent.name)) continue;
      stack.push(path.join(dir, ent.name));
    }
  }
}

function scanWorkspacePackages(repoRoot) {
  const map = Object.create(null);
  for (const top of ['packages', 'apps']) {
    const base = path.join(repoRoot, top);
    walkPackageDirs(base, (pkgDir) => {
      const pkgPath = path.join(pkgDir, 'package.json');
      let pkg;
      try {
        pkg = JSON.parse(readFileUtf8(pkgPath));
      } catch {
        return;
      }
      if (!pkg.name) return;
      map[pkg.name] = posixRel(repoRoot, pkgDir);
    });
  }
  return map;
}

function depSections(pkg) {
  return ['dependencies', 'optionalDependencies', 'peerDependencies'];
}

function collectDeps(pkg) {
  const out = Object.create(null);
  for (const section of depSections(pkg)) {
    if (!pkg[section]) continue;
    Object.assign(out, pkg[section]);
  }
  return out;
}

function resolveFileDep(packageDir, spec) {
  if (typeof spec !== 'string' || !spec.startsWith('file:')) return null;
  const raw = spec.slice('file:'.length);
  const target = path.resolve(packageDir, raw);
  if (!fs.existsSync(path.join(target, 'package.json'))) return null;
  return target;
}

function workspaceClosure(repoRoot, startPackageDir, options = {}) {
  const omitFromResult = new Set(
    (options.omitFromResult || []).map((r) => r.replace(/\\/g, '/')),
  );
  const workspaceMap = scanWorkspacePackages(repoRoot);
  const nameToRel = workspaceMap;

  const startRel = posixRel(repoRoot, startPackageDir);
  const closureRels = new Set();
  const queue = [startRel];

  while (queue.length) {
    const rel = queue.shift();
    if (!rel || closureRels.has(rel)) continue;
    const pkgDir = path.join(repoRoot, rel.split('/').join(path.sep));
    const pkgPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    closureRels.add(rel);

    const pkg = JSON.parse(readFileUtf8(pkgPath));
    const deps = collectDeps(pkg);
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) {
        const depRel = nameToRel[name];
        if (depRel) queue.push(depRel);
        continue;
      }
      if (typeof spec === 'string' && spec.startsWith('file:')) {
        const resolved = resolveFileDep(pkgDir, spec);
        if (!resolved) continue;
        const depRel = posixRel(repoRoot, resolved);
        if (depRel) queue.push(depRel);
        continue;
      }
      if (nameToRel[name]) {
        queue.push(nameToRel[name]);
      }
    }
  }

  const filtered = [...closureRels].filter((r) => !omitFromResult.has(r));
  const resultRels = orderClosureForStaging(repoRoot, filtered);
  return {
    workspaceMap: nameToRel,
    closureRels: resultRels,
  };
}

function orderClosureForStaging(repoRoot, closureRels) {
  const relSet = new Set(closureRels);
  const workspaceMap = scanWorkspacePackages(repoRoot);
  const inDegree = new Map();
  const graph = new Map();
  for (const rel of closureRels) {
    inDegree.set(rel, 0);
    graph.set(rel, []);
  }
  for (const rel of closureRels) {
    const pkgDir = path.join(repoRoot, rel.split('/').join(path.sep));
    const pkgPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileUtf8(pkgPath));
    const deps = collectDeps(pkg);
    for (const name of Object.keys(deps)) {
      const depRel = workspaceMap[name];
      if (!depRel || !relSet.has(depRel) || depRel === rel) continue;
      graph.get(depRel).push(rel);
      inDegree.set(rel, (inDegree.get(rel) || 0) + 1);
    }
  }
  const queue = closureRels.filter((r) => (inDegree.get(r) || 0) === 0);
  const ordered = [];
  while (queue.length) {
    const n = queue.shift();
    ordered.push(n);
    for (const m of graph.get(n) || []) {
      inDegree.set(m, inDegree.get(m) - 1);
      if (inDegree.get(m) === 0) queue.push(m);
    }
  }
  if (ordered.length !== closureRels.length) {
    return [...closureRels].sort();
  }
  return ordered;
}

function workspaceFileSpec(fromPackageRel, toPackageRel) {
  const fromDir = fromPackageRel.split('/').join(path.sep);
  const toPath = toPackageRel.split('/').join(path.sep);
  let rel = path.relative(fromDir, toPath).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return `file:${rel}`;
}

function buildDepRewrites(repoRoot, packageRel, closureRels) {
  const workspaceMap = scanWorkspacePackages(repoRoot);
  const closureSet = new Set(closureRels);
  const pkgDir = path.join(repoRoot, packageRel.split('/').join(path.sep));
  const pkg = JSON.parse(readFileUtf8(path.join(pkgDir, 'package.json')));
  const deps = collectDeps(pkg);
  const rewrites = Object.create(null);

  for (const name of Object.keys(deps)) {
    const depRel = workspaceMap[name];
    if (!depRel || !closureSet.has(depRel)) continue;
    if (depRel === packageRel) continue;
    rewrites[name] = workspaceFileSpec(packageRel, depRel);
  }
  return rewrites;
}

function readClosureListFromFile(filePath) {
  const parsed = JSON.parse(readFileUtf8(filePath));
  if (!Array.isArray(parsed)) {
    throw new Error(`closure list file must contain a JSON array: ${filePath}`);
  }
  return parsed;
}

module.exports = {
  scanWorkspacePackages,
  workspaceClosure,
  workspaceFileSpec,
  buildDepRewrites,
  orderClosureForStaging,
  readClosureListFromFile,
  SKIP_DIR_NAMES,
};

if (require.main === module) {
  const cmd = process.argv[2];
  const repoRoot = process.argv[3];
  if (!cmd || !repoRoot) {
    console.error('Usage: node workspace-packages.js <closure|rewrites> <repoRoot> [packageRel]');
    process.exit(1);
  }
  if (cmd === 'closure') {
    const controllerDir = process.argv[4];
    if (!controllerDir) {
      console.error('Usage: node workspace-packages.js closure <repoRoot> <controllerDir>');
      process.exit(1);
    }
    const omit = (process.env.RAVEN_STAGE_OMIT_RELS || 'apps/controller,packages/integrations/virtualdeck')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const { closureRels } = workspaceClosure(repoRoot, controllerDir, {
      omitFromResult: omit,
    });
    process.stdout.write(`${JSON.stringify(closureRels)}\n`);
    process.exit(0);
  }
  if (cmd === 'rewrites') {
    const packageRel = process.argv[4];
    const closureFile = process.argv[5];
    if (!packageRel || !closureFile) {
      console.error('Usage: node workspace-packages.js rewrites <repoRoot> <packageRel> <closureListFile>');
      process.exit(1);
    }
    const closureRels = readClosureListFromFile(closureFile);
    const rewrites = buildDepRewrites(repoRoot, packageRel, closureRels);
    process.stdout.write(`${JSON.stringify(rewrites)}\n`);
    process.exit(0);
  }
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
