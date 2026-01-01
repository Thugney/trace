# PWA Icons Guide

## Current Status
This folder contains an SVG icon template (`icon.svg`) that represents the Family Learning Hub branding.

## Required Icon Files
For a complete PWA installation, you need the following PNG files:
- `pwa-192x192.png` - 192x192 pixels (required for Android)
- `pwa-512x512.png` - 512x512 pixels (required for Android, also used for maskable)
- `apple-touch-icon.png` - 180x180 pixels (recommended for iOS)
- `favicon.ico` - 32x32 pixels (browser tab icon)

## How to Generate Icons

### Option 1: Using ImageMagick (Linux/Docker)
If you have ImageMagick installed:
```bash
# Generate 192x192
convert icon.svg -resize 192x192 pwa-192x192.png

# Generate 512x512
convert icon.svg -resize 512x512 pwa-512x512.png

# Generate Apple touch icon
convert icon.svg -resize 180x180 apple-touch-icon.png

# Generate favicon
convert icon.svg -resize 32x32 favicon.ico
```

### Option 2: Using Node.js (sharp library)
Install sharp: `npm install -D sharp`

Then run the icon generation script (if available) or use this code:
```javascript
const sharp = require('sharp');
const fs = require('fs');

const sizes = [
  { size: 192, name: 'pwa-192x192.png' },
  { size: 512, name: 'pwa-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' }
];

const svgBuffer = fs.readFileSync('icon.svg');

sizes.forEach(({ size, name }) => {
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(name)
    .then(() => console.log(`✓ Generated ${name}`));
});
```

### Option 3: Online Tools
Use online converters like:
- https://realfavicongenerator.net/
- https://www.pwabuilder.com/imageGenerator
- https://www.favicon-generator.org/

Upload `icon.svg` and download all required sizes.

### Option 4: Custom Design
Replace `icon.svg` with your own branded icon and regenerate the PNG files.

## Color Scheme
The current icon uses:
- Primary: #4F46E5 (Indigo 600)
- Accent: #FCD34D (Yellow 300)
- Background: White (#FFFFFF)

## Current Icon Design
- Book with graduation cap (representing learning)
- "LH" text at bottom (Learning Hub)
- Indigo background matching app theme

Feel free to customize this design to match your brand!
