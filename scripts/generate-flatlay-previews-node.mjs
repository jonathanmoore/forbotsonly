#!/usr/bin/env node

/**
 * Generate flat-lay preview composites: black tee + mark on left chest
 * Node.js version (compatible with standard node runtime)
 */

import { join, dirname } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHAPES = [
  'blob', 'circle', 'vertical-oval', 'rounded-square', 'horizontal-pill',
  'rounded-triangle', 'hexagon', 'cloud', 'teardrop'
];

const COLORS = [
  'white', 'brown', 'red', 'orange', 'gold', 'light-green',
  'teal', 'blue', 'purple', 'hot-pink', 'grey'
];

/**
 * Simple black tee silhouette (front-facing flat-lay, sleeves out)
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

async function generateFlatLayComposite(shape, color) {
  const markPath = join(__dirname, '..', 'assets', 'marks', `grok-bot-${shape}-${color}.svg`);
  
  const markSvg = await readFile(markPath, 'utf-8');
  
  const markContent = markSvg
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .trim();
  
  const markX = 430;
  const markY = 260;
  const markScale = 0.35;
  
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

async function generateFlatLayPreviews() {
  const outputDir = join(__dirname, '..', 'public', 'images', 'previews');
  
  await mkdir(outputDir, { recursive: true });
  
  console.log('🖼️  Generating flat-lay preview composites...\n');
  
  let count = 0;
  
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      try {
        const svg = await generateFlatLayComposite(shape, color);
        const filename = `flatlay-${shape}-${color}.svg`;
        const filepath = join(outputDir, filename);
        
        await writeFile(filepath, svg, 'utf-8');
        count++;
        
        if (count % 20 === 0) {
          console.log(`  Generated ${count} flat-lay previews...`);
        }
      } catch (err) {
        console.error(`  ⚠️  Failed to generate ${shape}-${color}:`, err.message);
      }
    }
  }
  
  console.log(`\n✨ Done! Generated ${count} flat-lay preview composites`);
  console.log(`   📂 Output: ${outputDir}`);
  console.log(`   📐 Format: SVG (800×800, mark on left chest)`);
  console.log(`   🎯 Mark placement: Wearer's left chest (right side when facing tee)\n`);
}

generateFlatLayPreviews().catch(console.error);
