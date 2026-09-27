// Build preparation script for VirtualDeck
// This ensures all test media files are available for distribution

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const userDataPath = process.env.APPDATA ? 
  path.join(process.env.APPDATA, 'VirtualDeck') : 
  path.join(process.env.HOME, '.config', 'VirtualDeck');

const publicPath = path.join(__dirname, 'public');

console.log('🔧 Preparing VirtualDeck for build...');

// P0 Security Check: Ensure no API keys are being bundled
console.log('🔒 Running security checks...');

const dangerousFiles = [
  '.env',
  'raven.env',
  'twitch-oauth-config.js',
  path.join('extra', 'raven', 'raven.env'),
  path.join('extra', 'raven', '.env')
];

let foundDangerousFile = false;
for (const file of dangerousFiles) {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.error(`❌ SECURITY ERROR: Found ${file}`);
    console.error(`   This file should NOT be bundled in the installer.`);
    console.error(`   It likely contains API keys or credentials.`);
    foundDangerousFile = true;
  }
}

if (foundDangerousFile) {
  console.error('\n❌ Build aborted to prevent credential leakage.');
  console.error('   Remove sensitive files before building.');
  process.exit(1);
}

console.log('✅ No sensitive credential files found');

const ravenExtra = path.join(__dirname, 'extra', 'raven');
if (!fs.existsSync(path.join(ravenExtra, 'sidecar.js'))) {
  fse.ensureDirSync(ravenExtra);
  const keep = path.join(ravenExtra, 'README.txt');
  if (!fs.existsSync(keep)) {
    fs.writeFileSync(
      keep,
      'Raven voice AI was not staged. From VirtualDeck run: npm run stage-raven\n' +
      'IMPORTANT: Never bundle raven.env with API keys. Users must provide their own keys.\n'
    );
  }
  console.log('⚠️  extra/raven has no sidecar yet — run npm run stage-raven for the combined installer.');
} else {
  // If Raven is staged, check for any .env or credential files
  const ravenEnvFile = path.join(ravenExtra, 'raven.env');
  if (fs.existsSync(ravenEnvFile)) {
    const envContent = fs.readFileSync(ravenEnvFile, 'utf-8');
    
    // Check if any API keys are populated (non-empty values)
    const hasKeys = /^(LLM_API_KEY|TTS_API_KEY|OPENAI_API_KEY|ELEVENLABS_API_KEY)\s*=\s*.+$/m.test(envContent);
    
    if (hasKeys) {
      console.error('❌ SECURITY ERROR: extra/raven/raven.env contains API keys!');
      console.error('   API keys should NEVER be bundled in the installer.');
      console.error('   Users must provide their own keys.');
      console.error('   Remove the API keys from raven.env before building.');
      process.exit(1);
    }
  }
  console.log('✅ Raven staged and no API keys detected');
}

// Ensure userData directory exists
fse.ensureDirSync(userDataPath);

// Copy test media files to userData for bundling
const mediaFiles = [
  // Overlay test media
  { from: 'public/images/VirtualDeck2.png', to: 'images/VirtualDeck2.png' },
  { from: 'public/videos/generated-video-fc791ab6-ec59-40d3-bbd3-9e0784f4f2cb.mp4', to: 'videos/generated-video.mp4' },
  // Halloween night skin assets
  { from: 'public/backgrounds/GPT_Image_1_A_haunting_digital_painting_in_a_dimly_lit_Hallowe_0.png', to: 'backgrounds/halloween-night.png' },
  { from: 'public/backgrounds/Image2.jpg', to: 'backgrounds/Image2.jpg' },
  { from: 'public/images/blood-png-7162.png', to: 'images/blood-png-7162.png' },
  { from: 'public/images/—Pngtree—red scary blood border_6652610.png', to: 'images/blood-border.png' },
  // Additional test video
  { from: 'public/videos/Download.mp4', to: 'videos/Download.mp4' }
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

// Create a build info file
const buildInfo = {
  timestamp: new Date().toISOString(),
  version: require('./package.json').version,
  testMedia: mediaFiles.map(f => f.to)
};

fs.writeFileSync(
  path.join(userDataPath, 'build-info.json'), 
  JSON.stringify(buildInfo, null, 2)
);

console.log('🎉 Build preparation complete!');
console.log(`📁 Test media files copied to: ${userDataPath}`);
console.log('📋 Build info saved to: build-info.json');
