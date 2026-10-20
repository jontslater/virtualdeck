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

function readPnpmWorkspacePatterns(repoRoot) {
  const file = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(file)) {
    return ['packages/*', 'apps/*'];
  }
  const patterns = [];
  for (const line of readFileUtf8(file).split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
    if (m) patterns.push(m[1].trim());
  }
  return patterns.length ? patterns : ['packages/*', 'apps/*'];
}

function expandWorkspacePattern(repoRoot, pattern) {
  const norm = pattern.replace(/\\/g, '/').replace(/\/+$/, '');
  const relDirs = [];

  if (norm.endsWith('/**')) {
    const baseRel = norm.slice(0, -3);
    const base = path.join(repoRoot, baseRel.split('/').join(path.sep));
    walkPackageDirs(base, (pkgDir) => {
      relDirs.push(posixRel(repoRoot, pkgDir));
    });
    return relDirs;
  }

  if (norm.includes('*')) {
    const star = norm.indexOf('*');
    const parentRel = norm.slice(0, star).replace(/\/$/, '');
    const parent = path.join(repoRoot, parentRel.split('/').join(path.sep));
    if (!fs.existsSync(parent)) return relDirs;
    const suffix = norm.slice(star + 1);
    for (const ent of fs.readdirSync(parent, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const candidateRel = parentRel ? `${parentRel}/${ent.name}${suffix}` : `${ent.name}${suffix}`;
      const candidate = path.join(repoRoot, candidateRel.split('/').join(path.sep));
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        relDirs.push(candidateRel);
      }
      if (!suffix) {
        walkPackageDirs(candidate, (pkgDir) => {
          const rel = posixRel(repoRoot, pkgDir);
          if (!relDirs.includes(rel)) relDirs.push(rel);
        });
      }
    }
    return relDirs;
  }

  const abs = path.join(repoRoot, norm.split('/').join(path.sep));
  if (fs.existsSync(path.join(abs, 'package.json'))) {
    relDirs.push(norm);
  }
  return relDirs;
}

function listWorkspacePackageDirs(repoRoot) {
  const patterns = readPnpmWorkspacePatterns(repoRoot);
  const relSet = new Set();
  for (const pattern of patterns) {
    for (const rel of expandWorkspacePattern(repoRoot, pattern)) {
      relSet.add(rel);
    }
  }
  // Nested packages (e.g. packages/integrations/virtualdeck) may sit outside a single glob.
  for (const top of ['packages', 'apps']) {
    const base = path.join(repoRoot, top);
    walkPackageDirs(base, (pkgDir) => {
      relSet.add(posixRel(repoRoot, pkgDir));
    });
  }
  return [...relSet];
}

function scanWorkspacePackages(repoRoot) {
  const map = Object.create(null);
  for (const rel of listWorkspacePackageDirs(repoRoot)) {
    const pkgDir = path.join(repoRoot, rel.split('/').join(path.sep));
    const pkgPath = path.join(pkgDir, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(readFileUtf8(pkgPath));
    } catch {
      continue;
    }
    if (!pkg.name) continue;
    map[pkg.name] = rel;
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

function allPackagesBuildOrder(repoRoot) {
  const rels = listWorkspacePackageDirs(repoRoot).filter((rel) => rel.startsWith('packages/'));
  return orderClosureForStaging(repoRoot, rels);
}

function controllerBuildOrder(repoRoot) {
  const controllerDir = path.join(repoRoot, CONTROLLER_REL);
  const controllerPkg = path.join(controllerDir, 'package.json');
  if (!fs.existsSync(controllerPkg)) {
    return [];
  }
  const { closureRels } = workspaceClosure(repoRoot, controllerDir, { omitFromResult: [] });
  const ordered = orderClosureForStaging(repoRoot, closureRels);
  const withoutController = ordered.filter((r) => r !== CONTROLLER_REL);
  if (ordered.includes(CONTROLLER_REL)) {
    return [...withoutController, CONTROLLER_REL];
  }
  return [...withoutController, CONTROLLER_REL];
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

const CONTROLLER_REL = 'apps/controller';
const VIRTUALDECK_BRIDGE_REL = 'packages/integrations/virtualdeck';

function collectFileDependencyRels(repoRoot, packageRel) {
  const pkgDir = path.join(repoRoot, packageRel.split('/').join(path.sep));
  const pkgPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return [];
  }
  const pkg = JSON.parse(readFileUtf8(pkgPath));
  const deps = collectDeps(pkg);
  const rels = [];
  for (const spec of Object.values(deps)) {
    if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
    const resolved = resolveFileDep(pkgDir, spec);
    if (!resolved) continue;
    rels.push(posixRel(repoRoot, resolved));
  }
  return rels;
}

function getControllerFileDependencyRels(repoRoot) {
  return collectFileDependencyRels(repoRoot, CONTROLLER_REL);
}

/**
 * Verify every controller file: dependency already exists in the staged app tree.
 * The controller package.json is read from the SOURCE repo (<repoRoot>/apps/controller)
 * because this preflight runs before the controller itself is staged; file: targets are
 * resolved relative to the staged controller location (<stagedAppRoot>/apps/controller).
 * When repoRoot is omitted, the staged controller package.json is used.
 */
function assertControllerFileDepsStagedBeforeInstall(stagedAppRoot, repoRoot) {
  const controllerDir = path.join(stagedAppRoot, 'apps', 'controller');
  const pkgPath = repoRoot
    ? path.join(repoRoot, 'apps', 'controller', 'package.json')
    : path.join(controllerDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`controller package.json missing at ${pkgPath}`);
  }
  const pkg = JSON.parse(readFileUtf8(pkgPath));
  const deps = collectDeps(pkg);
  const missing = [];
  for (const [name, spec] of Object.entries(deps)) {
    if (typeof spec !== 'string' || !spec.startsWith('file:')) continue;
    const raw = spec.slice('file:'.length);
    const target = path.resolve(controllerDir, raw);
    if (!fs.existsSync(path.join(target, 'package.json'))) {
      missing.push(`${name} -> ${spec}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `controller file: dependencies must exist before npm install: ${missing.join('; ')}`,
    );
  }
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
  allPackagesBuildOrder,
  controllerBuildOrder,
  listWorkspacePackageDirs,
  readPnpmWorkspacePatterns,
  orderClosureForStaging,
  readClosureListFromFile,
  collectFileDependencyRels,
  getControllerFileDependencyRels,
  assertControllerFileDepsStagedBeforeInstall,
  CONTROLLER_REL,
  VIRTUALDECK_BRIDGE_REL,
  SKIP_DIR_NAMES,
};

if (require.main === module) {
  const cmd = process.argv[2];
  const repoRoot = process.argv[3];
  if (!cmd || !repoRoot) {
    console.error('Usage: node workspace-packages.js <closure|rewrites> <repoRoot> [packageRel]');
    process.exit(1);
  }
  if (cmd === 'packages-build-order') {
    const ordered = allPackagesBuildOrder(repoRoot);
    process.stdout.write(`${JSON.stringify(ordered)}\n`);
    process.exit(0);
  }
  if (cmd === 'controller-build-order') {
    const ordered = controllerBuildOrder(repoRoot);
    process.stdout.write(`${JSON.stringify(ordered)}\n`);
    process.exit(0);
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
  if (cmd === 'assert-controller-file-deps') {
    // argv: [node, script, cmd, repoRoot, stagedAppRoot] (matches stage-raven-runtime.ps1)
    const repoRoot = process.argv[3];
    const stagedAppRoot = process.argv[4];
    if (!repoRoot || !stagedAppRoot) {
      console.error('Usage: node workspace-packages.js assert-controller-file-deps <repoRoot> <stagedAppRoot>');
      process.exit(1);
    }
    try {
      assertControllerFileDepsStagedBeforeInstall(stagedAppRoot, repoRoot);
    } catch (err) {
      console.error(err.message || err);
      process.exit(2);
    }
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
