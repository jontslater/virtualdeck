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

// Ensure userData directory exists
fse.ensureDirSync(userDataPath);

// Copy test media files to userData for bundling
const mediaFiles = [
  // Overlay test media
  { from: 'public/images/VirtualDeck2.png', to: 'images/VirtualDeck2.png' },
  { from: 'public/videos/generated-video-fc791ab6-ec59-40d3-bbd3-9e0784f4f2cb.mp4', to: 'videos/generated-video.mp4' },
  // Halloween night skin assets
  { from: 'public/backgrounds/GPT_Image_1_A_haunting_digital_painting_in_a_dimly_lit_Hallowe_0.png', to: 'backgrounds/halloween-night.png' },
  { from: 'public/images/blood-png-7162.png', to: 'images/blood-png-7162.png' },
  { from: 'public/images/—Pngtree—red scary blood border_6652610.png', to: 'images/blood-border.png' }
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
