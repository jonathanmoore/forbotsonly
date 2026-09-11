#!/usr/bin/env node

/**
 * Convert SVG marks to PNG for Prodigi print API
 * 
 * Prodigi API accepts ONLY JPG, PNG, or PDF (not SVG)
 * Apparel requires PNG with transparent background
 * 
 * Converts all SVG marks from public/images/marks/ to PNG
 * Output: 800x800px @ 300dpi (~2.67" print size) with transparent background
 */

import { readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SVG_DIR = join(__dirname, '..', 'public', 'images', 'marks');
const PNG_DIR = join(__dirname, '..', 'public', 'images', 'marks');

// 800x800px @ 300dpi ≈ 2.67" (good quality for apparel chest print)
const PNG_SIZE = 800;

async function convertSvgToPng(svgPath, pngPath) {
  try {
    await sharp(svgPath, { density: 300 })
      .resize(PNG_SIZE, PNG_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    return true;
  } catch (err) {
    console.error(`  ❌ Failed to convert ${svgPath}:`, err.message);
    return false;
  }
}

async function generatePngMarks() {
  console.log('🖼️  Converting SVG marks to PNG for Prodigi print API...\n');
  console.log(`📐 Output: ${PNG_SIZE}x${PNG_SIZE}px @ 300dpi with transparent background\n`);
  
  await mkdir(PNG_DIR, { recursive: true });
  
  const files = await readdir(SVG_DIR);
  const svgFiles = files.filter(f => f.endsWith('.svg'));
  
  console.log(`Found ${svgFiles.length} SVG marks to convert\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const svgFile of svgFiles) {
    const pngFile = svgFile.replace('.svg', '.png');
    const svgPath = join(SVG_DIR, svgFile);
    const pngPath = join(PNG_DIR, pngFile);
    
    process.stdout.write(`Converting ${svgFile}... `);
    
    const success = await convertSvgToPng(svgPath, pngPath);
    if (success) {
      console.log('✓');
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n✨ Done!`);
  console.log(`   ✓ Converted: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ❌ Failed: ${failCount}`);
  }
  console.log(`\n📦 Output: ${PNG_DIR}`);
  console.log(`\n✅ PNG marks ready for Prodigi API (JPG, PNG, or PDF only - NO SVG)`);
}

generatePngMarks().catch(console.error);
