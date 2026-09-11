import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const svgPath = path.join(publicDir, 'favicon.svg');
const icoPath = path.join(publicDir, 'favicon.ico');

async function generateFavicon() {
  try {
    // Read the SVG
    const svgBuffer = fs.readFileSync(svgPath);
    
    // Generate a 32x32 PNG (ICO format)
    const png32 = await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toBuffer();
    
    // For now, just save as PNG (browsers will handle it)
    // True ICO generation would require a separate library
    fs.writeFileSync(icoPath, png32);
    
    console.log('✅ Generated favicon.ico');
  } catch (err) {
    console.error('❌ Failed to generate favicon:', err);
    process.exit(1);
  }
}

generateFavicon();
