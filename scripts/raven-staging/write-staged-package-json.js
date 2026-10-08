#!/usr/bin/env node
/**
 * Copy package.json with dependency rewrites (JSON file, not argv).
 * Usage: node write-staged-package-json.js <srcPackageJson> <destPackageJson> <rewritesJsonFile>
 */
const fs = require('fs');
const { readFileUtf8 } = require('./read-utf8');

const src = process.argv[2];
const dest = process.argv[3];
const rewritesFile = process.argv[4];

if (!src || !dest || !rewritesFile) {
  console.error('Usage: node write-staged-package-json.js <src> <dest> <rewrites.json>');
  process.exit(1);
}

const rewrites = JSON.parse(readFileUtf8(rewritesFile));
const pkg = JSON.parse(readFileUtf8(src));

for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
  if (!pkg[section]) continue;
  for (const [name, spec] of Object.entries(pkg[section])) {
    if (Object.prototype.hasOwnProperty.call(rewrites, name)) {
      pkg[section][name] = rewrites[name];
      continue;
    }
    if (typeof spec === 'string' && spec.startsWith('workspace:')) {
      if (Object.prototype.hasOwnProperty.call(rewrites, name)) {
        pkg[section][name] = rewrites[name];
      }
    }
  }
}

fs.writeFileSync(dest, `${JSON.stringify(pkg, null, 2)}\n`);
