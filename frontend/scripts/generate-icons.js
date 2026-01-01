#!/usr/bin/env node

/**
 * PWA Icon Generator
 *
 * Generates all required PWA icons from the source SVG
 * Requires: sharp library (npm install sharp)
 *
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is installed
let sharp;
try {
  sharp = require('sharp');
} catch (error) {
  console.error('❌ Error: sharp is not installed');
  console.error('   Please run: npm install sharp');
  console.error('   Then try again: node scripts/generate-icons.js');
  process.exit(1);
}

const publicDir = path.join(__dirname, '../public');
const iconSvg = path.join(publicDir, 'icon.svg');

// Check if source SVG exists
if (!fs.existsSync(iconSvg)) {
  console.error('❌ Error: icon.svg not found in public directory');
  process.exit(1);
}

const svgBuffer = fs.readFileSync(iconSvg);

// Icon configurations
const icons = [
  { size: 192, name: 'pwa-192x192.png', desc: 'Android PWA icon' },
  { size: 512, name: 'pwa-512x512.png', desc: 'Android PWA icon (large)' },
  { size: 180, name: 'apple-touch-icon.png', desc: 'iOS home screen icon' },
  { size: 32, name: 'favicon-32x32.png', desc: 'Browser favicon' },
  { size: 16, name: 'favicon-16x16.png', desc: 'Browser favicon (small)' }
];

console.log('🎨 Generating PWA icons from icon.svg...\n');

// Generate all icons
const promises = icons.map(({ size, name, desc }) => {
  return sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(path.join(publicDir, name))
    .then(() => {
      console.log(`✓ Generated ${name.padEnd(25)} (${size}x${size}) - ${desc}`);
    })
    .catch(err => {
      console.error(`✗ Failed to generate ${name}:`, err.message);
    });
});

// Generate favicon.ico (combine 16x16 and 32x32)
Promise.all(promises)
  .then(() => {
    console.log('\n✅ All PWA icons generated successfully!');
    console.log('\nGenerated files:');
    icons.forEach(({ name }) => {
      const filePath = path.join(publicDir, name);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`   - ${name.padEnd(25)} (${sizeKB} KB)`);
      }
    });
    console.log('\n💡 Tip: Run "npm run build" to include these icons in your PWA');
  })
  .catch(err => {
    console.error('\n❌ Error generating icons:', err);
    process.exit(1);
  });
