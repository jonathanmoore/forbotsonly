#!/usr/bin/env bun

/**
 * Grok Bot Character Mark Generator
 * Generates printable SVG assets for the forbotsonly merch store
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';

// Color palette (flat fills, matching picker UI)
const COLORS = {
  white: '#FFFFFF',
  brown: '#8B6F47',
  red: '#E63946',
  orange: '#FF6B35',
  gold: '#F4A261',
  'light-green': '#4CAF50',
  teal: '#26A69A',
  blue: '#2196F3',
  purple: '#9C27B0',
  'hot-pink': '#E91E63',
  grey: '#9E9E9E',
} as const;

type ColorName = keyof typeof COLORS;
type ShapeName = 'circle' | 'vertical-oval' | 'rounded-square' | 'horizontal-pill' | 
                 'rounded-triangle' | 'hexagon' | 'cloud' | 'teardrop';
type EyeLayout = 'default' | 'centered' | 'wider' | 'higher';

// Eye configuration (dark oblong "slot" eyes)
const EYE_COLOR = '#1A1A1A'; // Dark for contrast on all colors except white
const EYE_COLOR_ON_WHITE = '#2C2C2C'; // Slightly lighter for white backgrounds

// Eye layouts (coordinates and rotations for the capsule eyes)
const EYE_LAYOUTS: Record<EyeLayout, { left: { x: number; y: number; rotation: number }, right: { x: number; y: number; rotation: number } }> = {
  default: {
    // Slanted pair, asymmetric toward upper-right (as in preview)
    left: { x: 35, y: 42, rotation: -25 },
    right: { x: 58, y: 38, rotation: -25 },
  },
  centered: {
    // Symmetrically centered
    left: { x: 38, y: 45, rotation: 0 },
    right: { x: 56, y: 45, rotation: 0 },
  },
  wider: {
    // Further apart horizontally
    left: { x: 32, y: 45, rotation: 0 },
    right: { x: 62, y: 45, rotation: 0 },
  },
  higher: {
    // Positioned higher on the shape
    left: { x: 38, y: 38, rotation: 0 },
    right: { x: 56, y: 38, rotation: 0 },
  },
};

/**
 * Generate an eye capsule (oblong slot)
 */
function generateEye(x: number, y: number, rotation: number, color: string): string {
  return `<ellipse cx="${x}" cy="${y}" rx="4" ry="7" fill="${color}" transform="rotate(${rotation} ${x} ${y})"/>`;
}

/**
 * Shape path generators (all centered at 50,50 in 100x100 viewBox)
 */
const SHAPES: Record<ShapeName, (size?: number) => string> = {
  circle: (size = 40) => {
    const r = size / 2;
    return `<circle cx="50" cy="50" r="${r}"/>`;
  },
  
  'vertical-oval': (size = 40) => {
    const rx = size / 2 * 0.7;
    const ry = size / 2 * 1.15;
    return `<ellipse cx="50" cy="50" rx="${rx}" ry="${ry}"/>`;
  },
  
  'rounded-square': (size = 40) => {
    const s = size;
    const x = 50 - s / 2;
    const y = 50 - s / 2;
    const r = s * 0.18; // Squircle-like rounding
    return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" ry="${r}"/>`;
  },
  
  'horizontal-pill': (size = 40) => {
    const width = size * 1.3;
    const height = size * 0.65;
    const x = 50 - width / 2;
    const y = 50 - height / 2;
    const r = height / 2;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${r}" ry="${r}"/>`;
  },
  
  'rounded-triangle': (size = 40) => {
    // Equilateral triangle with rounded corners (point up)
    const h = size * 0.866; // Height of equilateral triangle
    const top = 50 - h * 0.6;
    const bottom = 50 + h * 0.4;
    const left = 50 - size / 2;
    const right = 50 + size / 2;
    
    // Using path with rounded corners
    return `<path d="M 50,${top + 2} L ${right - 2},${bottom} L ${left + 2},${bottom} Z" 
            stroke-linejoin="round" stroke-linecap="round" stroke-width="4"/>`;
  },
  
  hexagon: (size = 40) => {
    // Flat-top hexagon with rounded corners
    const w = size / 2;
    const h = size / 2.3;
    const points = [
      [50 - w, 50],           // left
      [50 - w / 2, 50 - h],   // top-left
      [50 + w / 2, 50 - h],   // top-right
      [50 + w, 50],           // right
      [50 + w / 2, 50 + h],   // bottom-right
      [50 - w / 2, 50 + h],   // bottom-left
    ];
    
    // Create path with rounded corners
    const pathData = points.map((p, i) => {
      if (i === 0) return `M ${p[0]},${p[1]}`;
      return `L ${p[0]},${p[1]}`;
    }).join(' ') + ' Z';
    
    return `<path d="${pathData}" stroke-linejoin="round" stroke-linecap="round" stroke-width="3"/>`;
  },
  
  cloud: (size = 40) => {
    // 3-lobe cloud shape
    const r1 = size * 0.35;
    const r2 = size * 0.3;
    const r3 = size * 0.28;
    
    return `<g>
      <circle cx="${50 - r1 * 0.8}" cy="50" r="${r1}"/>
      <circle cx="50" cy="${50 - r2 * 0.5}" r="${r2}"/>
      <circle cx="${50 + r3 * 0.8}" cy="50" r="${r3}"/>
    </g>`;
  },
  
  teardrop: (size = 40) => {
    // Teardrop shape (point up, soft tip)
    const width = size * 0.7;
    const height = size;
    const cx = 50;
    const bottom = 50 + height / 2;
    const top = 50 - height / 2;
    
    return `<path d="M ${cx},${top} 
            C ${cx - width * 0.6},${top + height * 0.3} 
              ${cx - width / 2},${bottom - height * 0.2} 
              ${cx},${bottom}
            C ${cx + width / 2},${bottom - height * 0.2} 
              ${cx + width * 0.6},${top + height * 0.3} 
              ${cx},${top} Z"/>`;
  },
};

/**
 * Generate a complete SVG mark
 */
function generateMark(
  shape: ShapeName,
  color: ColorName,
  eyeLayout: EyeLayout = 'default',
  options: { width?: number; height?: number; pocketPrint?: boolean } = {}
): string {
  const { width = 100, height = 100, pocketPrint = false } = options;
  const fillColor = COLORS[color];
  const eyeColor = color === 'white' ? EYE_COLOR_ON_WHITE : EYE_COLOR;
  const eyes = EYE_LAYOUTS[eyeLayout];
  
  // For pocket print, use same centered 100×100 viewBox but scale to 192px (~2" @ 96dpi)
  const svgWidth = pocketPrint ? 192 : width;
  const svgHeight = pocketPrint ? 192 : height;
  const comment = pocketPrint ? '\n  <!-- Centered mark; viewBox 100 maps to 192px (~2" @ 96dpi). Do NOT use broken translate(-46,-46) scale. -->' : '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${comment}
  <g id="mark">
    <g id="shape" fill="${fillColor}" stroke="${fillColor}">
      ${SHAPES[shape]()}
    </g>
    <g id="eyes">
      ${generateEye(eyes.left.x, eyes.left.y, eyes.left.rotation, eyeColor)}
      ${generateEye(eyes.right.x, eyes.right.y, eyes.right.rotation, eyeColor)}
    </g>
  </g>
</svg>`;
}

/**
 * Generate filename for a mark
 */
function getFilename(
  shape: ShapeName,
  color: ColorName,
  eyeLayout: EyeLayout = 'default',
  pocketPrint = false
): string {
  const prefix = pocketPrint ? 'pocket-' : '';
  const eyeSuffix = eyeLayout !== 'default' ? `-eyes-${eyeLayout}` : '';
  return `${prefix}grok-bot-${shape}-${color}${eyeSuffix}.svg`;
}

/**
 * Main generation function
 */
async function generateMarks() {
  const outputDir = join(import.meta.dir, '..', 'assets', 'marks');
  
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });
  
  console.log('🤖 Generating Grok Bot character marks...\n');
  
  const shapes = Object.keys(SHAPES) as ShapeName[];
  const colors = Object.keys(COLORS) as ColorName[];
  const eyeLayouts = Object.keys(EYE_LAYOUTS) as EyeLayout[];
  
  let count = 0;
  
  // Generate base set: all shapes × all colors with default eyes
  for (const shape of shapes) {
    for (const color of colors) {
      const svg = generateMark(shape, color, 'default');
      const filename = getFilename(shape, color, 'default');
      const filepath = join(outputDir, filename);
      
      await Bun.write(filepath, svg);
      count++;
    }
  }
  
  console.log(`✓ Generated ${count} base marks (all shapes × colors with default eyes)`);
  
  // Generate eye layout variants for the hero mark (orange hexagon)
  let variantCount = 0;
  for (const eyeLayout of eyeLayouts) {
    if (eyeLayout !== 'default') {
      const svg = generateMark('hexagon', 'orange', eyeLayout);
      const filename = getFilename('hexagon', 'orange', eyeLayout);
      const filepath = join(outputDir, filename);
      
      await Bun.write(filepath, svg);
      variantCount++;
    }
  }
  
  console.log(`✓ Generated ${variantCount} eye layout variants for orange hexagon`);
  
  // Generate pocket-print hero mark (orange hexagon, 2" print-ready)
  const pocketSvg = generateMark('hexagon', 'orange', 'default', { 
    width: 192, 
    height: 192, 
    pocketPrint: true 
  });
  const pocketFilename = getFilename('hexagon', 'orange', 'default', true);
  const pocketFilepath = join(outputDir, pocketFilename);
  
  await Bun.write(pocketFilepath, pocketSvg);
  console.log(`✓ Generated pocket-print hero mark: ${pocketFilename}`);
  
  console.log(`\n✨ Done! Generated ${count + variantCount + 1} total SVG files in ${outputDir}`);
  console.log(`\n🎯 Hero mark (Chief of Staff): grok-bot-hexagon-orange.svg`);
  console.log(`🎽 Pocket-print hero: ${pocketFilename} (optimized for ~2" print on apparel)`);
}

// Run the generator
generateMarks().catch(console.error);
