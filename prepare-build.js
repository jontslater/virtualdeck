// Build preparation script for VirtualDeck
// This ensures all test media files are available for distribution

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const userDataPath = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'VirtualDeck')
  : path.join(process.env.HOME, '.config', 'VirtualDeck');

const publicPath = path.join(__dirname, 'public');
const SKIP_RAVEN = process.env.SKIP_RAVEN === '1';

const SECRET_KEY_PATTERN =
  /^\s*(LLM_API_KEY|TTS_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY)\s*[ \t]*=\s*[ \t]*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s#;\r\n][^\r\n]*))?/m;

const PLACEHOLDER_VALUES = new Set([
  '',
  'changeme',
  'change-me',
  'your-api-key',
  'your-key-here',
  'your_key_here',
  'placeholder',
  'todo',
  'tbd',
  'none',
  'null',
  'sk-your',
  'sk-your-key-here',
]);

function envTextHasPopulatedSecrets(text) {
  if (!text) return false;
  const lines = String(text).split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(SECRET_KEY_PATTERN);
    if (!match) continue;
    const raw = (match[2] || match[3] || match[4] || '').trim();
    if (!raw) continue;
    const lower = raw.toLowerCase();
    if (PLACEHOLDER_VALUES.has(lower)) continue;
    if (/^(your|my|insert|add|enter|put)[-_ ]/.test(lower)) continue;
    return true;
  }
  return false;
}

function normalizePattern(p) {
  return p.replace(/\\/g, '/');
}

function patternMatchesFile(pattern, relativePath) {
  const normPath = normalizePattern(relativePath);
  const normPattern = normalizePattern(pattern);

  if (normPattern === '**/*') return true;
  if (normPattern === normPath) return true;

  if (normPattern.endsWith('/**/*')) {
    const prefix = normPattern.slice(0, -5);
    return normPath === prefix || normPath.startsWith(`${prefix}/`);
  }

  if (normPattern.includes('*')) {
    const escaped = normPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*');
    return new RegExp(`^${escaped}$`).test(normPath);
  }

  return false;
}

function wouldElectronBuilderInclude(relativePath) {
  const pkg = require('./package.json');
  const patterns = pkg.build && Array.isArray(pkg.build.files) ? pkg.build.files : ['**/*'];
  const normPath = normalizePattern(relativePath);
  let included = false;

  for (const pattern of patterns) {
    const normPattern = normalizePattern(pattern);
    if (normPattern.startsWith('!')) {
      const neg = normPattern.slice(1);
      if (patternMatchesFile(neg, normPath)) {
        included = false;
      }
      continue;
    }
    if (patternMatchesFile(normPattern, normPath)) {
      included = true;
    }
  }

  return included;
}

function extraResourcesRoots() {
  const pkg = require('./package.json');
  const roots = [];
  const entries = (pkg.build && pkg.build.extraResources) || [];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      roots.push(path.resolve(__dirname, entry));
    } else if (entry && entry.from) {
      roots.push(path.resolve(__dirname, entry.from));
    }
  }
  return roots;
}

function scanDirectoryForCredentialFiles(rootDir) {
  const hits = [];
  if (!fs.existsSync(rootDir)) return hits;

  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        if (name === 'node_modules') continue;
        walk(full);
        continue;
      }
      if (name === '.env' || name === 'raven.env' || name === 'twitch-oauth-config.js') {
        hits.push(path.relative(__dirname, full));
      }
      if (name === 'env.defaults' || name.endsWith('.env')) {
        const content = fs.readFileSync(full, 'utf8');
        if (envTextHasPopulatedSecrets(content)) {
          hits.push(`${path.relative(__dirname, full)} (populated API keys)`);
        }
      }
    }
  };

  walk(rootDir);
  return hits;
}

function runPrepareBuild() {
console.log('🔧 Preparing VirtualDeck for build...');
console.log('🔒 Running security checks...');

const rootCredentialFiles = ['.env', 'raven.env', 'twitch-oauth-config.js'];
let securityFailed = false;

for (const file of rootCredentialFiles) {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) continue;
  if (wouldElectronBuilderInclude(file)) {
    console.error(`❌ SECURITY ERROR: ${file} would be included in the app bundle (electron-builder files).`);
    console.error('   Remove it from build.files or delete the file before building.');
    securityFailed = true;
  } else {
    console.log(`ℹ️  ${file} exists locally but is not packaged by electron-builder — OK`);
  }
}

const ravenExtra = path.join(__dirname, 'extra', 'raven');
const sidecarPath = path.join(ravenExtra, 'sidecar.js');

if (!SKIP_RAVEN) {
  if (!fs.existsSync(sidecarPath)) {
    console.error('❌ Raven sidecar missing: extra/raven/sidecar.js');
    console.error('   Run: npm run stage-raven');
    console.error('   Or set SKIP_RAVEN=1 to build VirtualDeck without Raven.');
    securityFailed = true;
  } else {
    const ravenHits = scanDirectoryForCredentialFiles(ravenExtra);
    if (ravenHits.length) {
      console.error('❌ SECURITY ERROR: staged Raven bundle contains credential material:');
      for (const hit of ravenHits) {
        console.error(`   - ${hit}`);
      }
      securityFailed = true;
    } else {
      console.log('✅ Raven staged and no API keys detected in extra/raven');
    }
  }
} else {
  console.log('ℹ️  SKIP_RAVEN=1 — skipping Raven sidecar requirement');
  if (!fs.existsSync(sidecarPath)) {
    fse.ensureDirSync(ravenExtra);
    const keep = path.join(ravenExtra, 'README.txt');
    if (!fs.existsSync(keep)) {
      fs.writeFileSync(
        keep,
        'Raven voice AI was not staged. From VirtualDeck run: npm run stage-raven\n' +
          'IMPORTANT: Never bundle raven.env with API keys. Users must provide their own keys.\n',
      );
    }
    console.log('⚠️  extra/raven has no sidecar — Raven will not be bundled.');
  }
}

for (const extraRoot of extraResourcesRoots()) {
  const rel = path.relative(__dirname, extraRoot) || path.basename(extraRoot);
  if (fs.existsSync(extraRoot) && rel.startsWith('extra')) {
    const hits = scanDirectoryForCredentialFiles(extraRoot);
    if (hits.length) {
      console.error(`❌ SECURITY ERROR: extraResources source "${rel}" contains secrets:`);
      for (const hit of hits) {
        console.error(`   - ${hit}`);
      }
      securityFailed = true;
    }
  }
}

if (securityFailed) {
  console.error('\n❌ Build aborted to prevent credential leakage.');
  process.exit(1);
}

console.log('✅ Packaging security checks passed');

// Ensure userData directory exists
fse.ensureDirSync(userDataPath);

// Copy test media files to userData for bundling
const mediaFiles = [
  { from: 'public/images/VirtualDeck2.png', to: 'images/VirtualDeck2.png' },
  {
    from: 'public/videos/generated-video-fc791ab6-ec59-40d3-bbd3-9e0784f4f2cb.mp4',
    to: 'videos/generated-video.mp4',
  },
  {
    from: 'public/backgrounds/GPT_Image_1_A_haunting_digital_painting_in_a_dimly_lit_Hallowe_0.png',
    to: 'backgrounds/halloween-night.png',
  },
  { from: 'public/backgrounds/Image2.jpg', to: 'backgrounds/Image2.jpg' },
  { from: 'public/images/blood-png-7162.png', to: 'images/blood-png-7162.png' },
  {
    from: 'public/images/—Pngtree—red scary blood border_6652610.png',
    to: 'images/blood-border.png',
  },
  { from: 'public/videos/Download.mp4', to: 'videos/Download.mp4' },
];

mediaFiles.forEach(({ from, to }) => {
  const sourcePath = path.join(__dirname, from);
  const destPath = path.join(userDataPath, to);

  if (fs.existsSync(sourcePath)) {
    fse.ensureDirSync(path.dirname(destPath));
    fse.copySync(sourcePath, destPath);
    console.log(`✅ Copied ${from} → ${to}`);
  } else {
    console.log(`⚠️  Missing: ${from}`);
  }
});

const buildInfo = {
  timestamp: new Date().toISOString(),
  version: require('./package.json').version,
  testMedia: mediaFiles.map((f) => f.to),
};

fs.writeFileSync(path.join(userDataPath, 'build-info.json'), JSON.stringify(buildInfo, null, 2));

console.log('🎉 Build preparation complete!');
console.log(`📁 Test media files copied to: ${userDataPath}`);
console.log('📋 Build info saved to: build-info.json');
}

module.exports = {
  envTextHasPopulatedSecrets,
  wouldElectronBuilderInclude,
  patternMatchesFile,
  runPrepareBuild,
};

if (require.main === module) {
  runPrepareBuild();
}
