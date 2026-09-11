#!/usr/bin/env node

/**
 * Generate Prodigi full-canvas positioned artwork for GLOBAL-TEE-BC-3001
 * 
 * Per PRODUCT_IMAGERY.md:
 * - Canvas: Transparent PNG matching Prodigi printAreaSizes.front
 * - Mark: 360×360px (~1.2" @ 300dpi) rasterized from SVG
 * - Placement: Wearer's left chest = right half of front-facing canvas
 *              ~2.5–4" below HPS, clear of centerline
 * 
 * Prodigi API accepts ONLY JPG, PNG, or PDF (NOT SVG)
 * fillPrintArea on a small logo stretches it incorrectly
 * Solution: Bake positioned mark onto full-canvas transparent PNG
 */

import { readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MARKS_SVG_DIR = join(__dirname, '..', 'public', 'images', 'marks');
const OUTPUT_DIR = join(__dirname, '..', 'public', 'images', 'prodigi-positioned');

// Prodigi GLOBAL-TEE-BC-3001 printAreaSizes.front
// Common sizes: 2480×3507 or 4677×5787
// Using standard size for consistency
const CANVAS_WIDTH = 2480;
const CANVAS_HEIGHT = 3507;

// Mark size: 360×360px (~1.2" @ 300dpi)
const MARK_SIZE = 360;

// Left chest positioning (wearer's left = right half of front-facing canvas)
// ~3" below HPS (~900px from top @ 300dpi)
// ~1" from right edge (~300px from right @ 300dpi)
const MARK_OFFSET_TOP = 900;
const MARK_OFFSET_RIGHT = 300;

// Calculate mark position
const MARK_X = CANVAS_WIDTH - MARK_OFFSET_RIGHT - MARK_SIZE;
const MARK_Y = MARK_OFFSET_TOP;

async function generatePositionedArtwork(svgPath, outputPath) {
  try {
    // Create transparent canvas
    const canvas = sharp({
      create: {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Rasterize SVG to 360×360px
    const markBuffer = await sharp(svgPath)
      .resize(MARK_SIZE, MARK_SIZE, { 
        fit: 'contain', 
        background: { r: 0, g: 0, b: 0, alpha: 0 } 
      })
      .png()
      .toBuffer();

    // Composite mark onto canvas at left chest position
    await canvas
      .composite([{
        input: markBuffer,
        top: MARK_Y,
        left: MARK_X
      }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    return true;
  } catch (err) {
    console.error(`  ❌ Failed:`, err.message);
    return false;
  }
}

async function generateAllPositionedArtwork() {
  console.log('🎽 Generating Prodigi positioned artwork for GLOBAL-TEE-BC-3001\n');
  console.log(`📐 Canvas: ${CANVAS_WIDTH}×${CANVAS_HEIGHT}px (printAreaSizes.front @ 300dpi)`);
  console.log(`🎯 Mark: ${MARK_SIZE}×${MARK_SIZE}px (~1.2" @ 300dpi)`);
  console.log(`📍 Position: Left chest (wearer's left = right side of front canvas)`);
  console.log(`   X: ${MARK_X}px from left (${MARK_OFFSET_RIGHT}px from right edge)`);
  console.log(`   Y: ${MARK_Y}px from top (~${(MARK_OFFSET_TOP / 300).toFixed(1)}" below HPS)\n`);
  
  await mkdir(OUTPUT_DIR, { recursive: true });
  
  const files = await readdir(MARKS_SVG_DIR);
  const svgFiles = files.filter(f => f.endsWith('.svg') && f.startsWith('grok-bot-'));
  
  console.log(`Found ${svgFiles.length} mark SVGs to position\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const svgFile of svgFiles) {
    const pngFile = svgFile.replace('.svg', '-positioned.png');
    const svgPath = join(MARKS_SVG_DIR, svgFile);
    const pngPath = join(OUTPUT_DIR, pngFile);
    
    process.stdout.write(`Positioning ${svgFile}... `);
    
    const success = await generatePositionedArtwork(svgPath, pngPath);
    if (success) {
      console.log('✓');
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`\n✨ Done!`);
  console.log(`   ✓ Generated: ${successCount}`);
  if (failCount > 0) {
    console.log(`   ❌ Failed: ${failCount}`);
  }
  console.log(`\n📦 Output: ${OUTPUT_DIR}`);
  console.log(`\n✅ Full-canvas positioned PNGs ready for Prodigi API`);
  console.log(`   - Canvas: ${CANVAS_WIDTH}×${CANVAS_HEIGHT}px transparent PNG`);
  console.log(`   - Mark: ${MARK_SIZE}×${MARK_SIZE}px on left chest`);
  console.log(`   - Use with Prodigi assets[].url (printArea: "front")`);
  console.log(`   - Do NOT use fillPrintArea on bare logo - these are pre-positioned`);
}

generateAllPositionedArtwork().catch(console.error);
