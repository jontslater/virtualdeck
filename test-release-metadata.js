#!/usr/bin/env node
/**
 * Ensures version and electron-builder publish settings stay aligned with GitHub Releases.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('./package.json');
const build = pkg.build || {};

console.log('🧪 release metadata tests\n');

assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'package.json version must be semver x.y.z');
assert.ok(build.publish && build.publish.provider === 'github', 'build.publish must target GitHub');
assert.strictEqual(build.publish.owner, 'jontslater');
assert.strictEqual(build.publish.repo, 'virtualdeck');

const win = build.win || {};
assert.ok(win.artifactName, 'win.artifactName must be set for stable latest.yml paths');
assert.ok(win.artifactName.includes('${version}'), 'artifactName must include ${version}');

const repoField = pkg.repository && (pkg.repository.url || pkg.repository);
assert.ok(String(repoField).includes('jontslater/virtualdeck'), 'repository URL must point at jontslater/virtualdeck');

const versioningDoc = path.join(__dirname, 'docs', 'VERSIONING.md');
assert.ok(fs.existsSync(versioningDoc), 'docs/VERSIONING.md must exist');

console.log('✅ package.json version:', pkg.version);
console.log('✅ artifactName:', win.artifactName);
console.log('\n✅ release metadata tests passed');
