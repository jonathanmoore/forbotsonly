#!/usr/bin/env bun

/**
 * Generate flat-lay preview composites: black tee + mark on left chest
 * 
 * Creates SVG composites for all shape+color combinations, with mark
 * positioned on left chest (wearer's left = right side when facing tee).
 */

import { join } from 'path';
import { mkdir, readFile } from 'fs/promises';

const SHAPES = [
  'blob', 'circle', 'vertical-oval', 'rounded-square', 'horizontal-pill',
  'rounded-triangle', 'hexagon', 'cloud', 'teardrop'
] as const;

const COLORS = [
  'white', 'brown', 'red', 'orange', 'gold', 'light-green',
  'teal', 'blue', 'purple', 'hot-pink', 'grey'
] as const;

type Shape = typeof SHAPES[number];
type Color = typeof COLORS[number];

/**
 * Simple black tee silhouette (front-facing flat-lay, sleeves out)
 * Viewbox: 0 0 800 800 for plenty of space
 */
const TEE_SILHOUETTE = `
  <!-- Black tee body (simplified flat-lay) -->
  <rect x="250" y="150" width="300" height="500" rx="20" fill="#0A0A0A"/>
  
  <!-- Neckline -->
  <ellipse cx="400" cy="150" rx="60" ry="30" fill="#1A1A1A"/>
  
  <!-- Left sleeve (viewer's left) -->
  <rect x="120" y="200" width="130" height="180" rx="15" fill="#0A0A0A"/>
  
  <!-- Right sleeve (viewer's right) -->
  <rect x="550" y="200" width="130" height="180" rx="15" fill="#0A0A0A"/>
  
  <!-- Subtle seam lines for dimension -->
  <line x1="280" y1="200" x2="280" y2="600" stroke="#1A1A1A" stroke-width="2"/>
  <line x1="520" y1="200" x2="520" y2="600" stroke="#1A1A1A" stroke-width="2"/>
`;

/**
 * Generate flat-lay composite SVG with mark on left chest
 * Mark positioned on wearer's left = right side when facing tee
 */
async function generateFlatLayComposite(
  shape: Shape,
  color: Color
): Promise<string> {
  const markPath = join(import.meta.dir, '..', 'assets', 'marks', `grok-bot-${shape}-${color}.svg`);
  
  // Read the mark SVG
  const markSvg = await readFile(markPath, 'utf-8');
  
  // Extract the mark's main content (skip XML declaration and svg wrapper)
  const markContent = markSvg
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .trim();
  
  // Position mark on left chest (wearer's left = right side when facing tee)
  // ~430px from left, ~260px from top for left chest placement
  const markX = 430;
  const markY = 260;
  const markScale = 0.35; // Scale down mark to ~1.2" equivalent on tee
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="800" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
  <!-- Flat-lay preview: Black tee with ${shape} mark in ${color} on left chest -->
  <defs>
    <style>
      .flatlay-background { fill: #F5F5F5; }
      .tee { fill: #0A0A0A; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="800" height="800" class="flatlay-background"/>
  
  <!-- Black tee (front-facing flat-lay) -->
  <g class="tee">
    ${TEE_SILHOUETTE}
  </g>
  
  <!-- Mark on left chest (wearer's left = right side facing tee) -->
  <g transform="translate(${markX}, ${markY}) scale(${markScale})">
    ${markContent}
  </g>
</svg>`;
}

/**
 * Generate filename for flat-lay preview
 */
function getFlatLayFilename(shape: Shape, color: Color): string {
  return `flatlay-${shape}-${color}.svg`;
}

/**
 * Main generation function
 */
async function generateFlatLayPreviews() {
  const outputDir = join(import.meta.dir, '..', 'public', 'images', 'previews');
  
  await mkdir(outputDir, { recursive: true });
  
  console.log('🖼️  Generating flat-lay preview composites...\n');
  
  let count = 0;
  
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      try {
        const svg = await generateFlatLayComposite(shape, color);
        const filename = getFlatLayFilename(shape, color);
        const filepath = join(outputDir, filename);
        
        await Bun.write(filepath, svg);
        count++;
        
        if (count % 20 === 0) {
          console.log(`  Generated ${count} flat-lay previews...`);
        }
      } catch (err) {
        console.error(`  ⚠️  Failed to generate ${shape}-${color}:`, err);
      }
    }
  }
  
  console.log(`\n✨ Done! Generated ${count} flat-lay preview composites`);
  console.log(`   📂 Output: ${outputDir}`);
  console.log(`   📐 Format: SVG (800×800, mark on left chest)`);
  console.log(`   🎯 Mark placement: Wearer's left chest (right side when facing tee)\n`);
}

// Run the generator
generateFlatLayPreviews().catch(console.error);
