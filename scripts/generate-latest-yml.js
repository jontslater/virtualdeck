/**
 * Generates latest.yml for electron-updater after a Windows build.
 * Run from repo root after: npm run build:win -- --publish never
 * Reads dist/*.exe, writes dist/latest.yml so the release workflow can upload it.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const distDir = path.join(__dirname, '..', 'dist');
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
const productName = (pkg.build && pkg.build.productName) || pkg.name;

const exeNames = fs.readdirSync(distDir).filter((f) => f.endsWith('.exe') && !f.includes('unpacked'));
if (exeNames.length === 0) {
  console.error('No .exe found in dist/');
  process.exit(1);
}
if (exeNames.length > 1) {
  console.error('Multiple .exe in dist/, using first:', exeNames);
}
const exeName = exeNames[0];
const exePath = path.join(distDir, exeName);
const buf = fs.readFileSync(exePath);
const size = buf.length;
const sha512 = crypto.createHash('sha512').update(buf).digest('base64');
const releaseDate = new Date().toISOString();

const yml = `version: ${version}
files:
  - url: ${exeName}
    sha512: ${sha512}
    size: ${size}
path: ${exeName}
sha512: ${sha512}
releaseDate: '${releaseDate}'
`;

const outPath = path.join(distDir, 'latest.yml');
fs.writeFileSync(outPath, yml, 'utf8');
console.log('Wrote', outPath);
console.log('version:', version, 'path:', exeName, 'size:', size);
