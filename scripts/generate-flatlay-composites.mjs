#!/usr/bin/env node

/**
 * Generate photo-quality BC-3001 flatlay PNG composites
 * with Grok Bot marks for forbotsonly store.
 * 
 * This script:
 * 1. Reads base-bc3001-black-flatlay.png (1280×720 transparent photo tee)
 * 2. For each shape×color mark combination:
 *    - Loads mark SVG from assets/marks/grok-bot-{shape}-{color}.svg
 *    - Rasterizes SVG to 58×58px with alpha
 *    - Composites mark onto tee at left chest (wearer's left = viewer's right)
 *    - Saves as public/images/previews/flatlay-{shape}-{color}.png
 * 
 * Position formula (from issue #47):
 * - Canvas: 1280×720
 * - Mark size: 58px
 * - X ≈ W * 0.605 - MARK/2 = 1280 * 0.605 - 29 = 745
 * - Y ≈ H * 0.32 - MARK/2 = 720 * 0.32 - 29 = 201
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const MARK_SHAPES = [
  'circle',
  'vertical-oval',
  'rounded-square',
  'horizontal-pill',
  'rounded-triangle',
  'hexagon',
  'cloud',
  'teardrop',
];

const MARK_COLORS = [
  'white',
  'brown',
  'red',
  'orange',
  'gold',
  'light-green',
  'teal',
  'blue',
  'purple',
  'hot-pink',
  'grey',
];

// Canvas and mark positioning
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const MARK_SIZE = 58;
const MARK_X = Math.round(CANVAS_WIDTH * 0.605 - MARK_SIZE / 2); // 745
const MARK_Y = Math.round(CANVAS_HEIGHT * 0.32 - MARK_SIZE / 2); // 201

const BASE_PNG_PATH = 'public/images/base-bc3001-black-flatlay.png';
const OUTPUT_DIR = 'public/images/previews';
const MARKS_DIR = 'assets/marks';

async function generateComposite(shape, color) {
  const markPath = path.join(MARKS_DIR, `grok-bot-${shape}-${color}.svg`);
  const outputPath = path.join(OUTPUT_DIR, `flatlay-${shape}-${color}.png`);

  try {
    // Check if mark SVG exists
    await fs.access(markPath);

    // Load base tee PNG
    const baseTee = await sharp(BASE_PNG_PATH);

    // Rasterize mark SVG to 58×58 PNG buffer with transparency
    const markPng = await sharp(markPath)
      .resize(MARK_SIZE, MARK_SIZE, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Composite mark onto tee at specified position
    await baseTee
      .composite([
        {
          input: markPng,
          top: MARK_Y,
          left: MARK_X,
        },
      ])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    return { shape, color, success: true };
  } catch (error) {
    console.error(`❌ Failed to generate ${shape}-${color}:`, error.message);
    return { shape, color, success: false, error: error.message };
  }
}

async function main() {
  console.log('🎨 Generating BC-3001 flatlay composites...\n');
  console.log(`📐 Canvas: ${CANVAS_WIDTH}×${CANVAS_HEIGHT}`);
  console.log(`📍 Mark: ${MARK_SIZE}×${MARK_SIZE}px at (${MARK_X}, ${MARK_Y})\n`);

  // Verify base PNG exists
  try {
    await fs.access(BASE_PNG_PATH);
    console.log(`✅ Base PNG found: ${BASE_PNG_PATH}`);
  } catch {
    console.error(`❌ Base PNG not found: ${BASE_PNG_PATH}`);
    process.exit(1);
  }

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Generate all shape×color combinations
  const total = MARK_SHAPES.length * MARK_COLORS.length;
  console.log(`\n🔄 Generating ${total} composites...\n`);

  const results = [];
  let completed = 0;

  for (const shape of MARK_SHAPES) {
    for (const color of MARK_COLORS) {
      const result = await generateComposite(shape, color);
      results.push(result);
      completed++;

      if (result.success) {
        console.log(`✅ [${completed}/${total}] flatlay-${shape}-${color}.png`);
      } else {
        console.log(`❌ [${completed}/${total}] flatlay-${shape}-${color}.png - ${result.error}`);
      }
    }
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Success: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Output: ${OUTPUT_DIR}/`);

  if (failed > 0) {
    console.log('\n⚠️  Some composites failed. Missing mark SVGs?');
    const failedList = results.filter(r => !r.success);
    failedList.forEach(f => console.log(`   - ${f.shape}-${f.color}`));
    process.exit(1);
  }

  console.log('\n✨ All composites generated successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
