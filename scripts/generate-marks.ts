#!/usr/bin/env bun

/**
 * Grok Bot Character Mark Generator
 * Product mechanism: GrokBotMark face layout system
 * 
 * Eyes: Recompute left/right path d's from shape's face params
 * Recipe weights: Per-shape eye scale + GROK_BOT_RECIPE_FACE_TUNE
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';

// ViewBox with padding for eye overflow (blob brand default)
const VIEWBOX = '-15 -15 259 259';
const CENTER = 114.2705;

// Eye style: dark fill
const EYE_FILL = '#0A0A0A';

// Color palette (app picker swatches)
const COLORS = {
  white: '#FFFFFF',
  brown: '#8B6F47',
  red: '#E63946',
  orange: '#FF6B35', // Brand color
  gold: '#F4A261',
  'light-green': '#4CAF50',
  teal: '#26A69A',
  blue: '#2196F3',
  purple: '#9C27B0',
  'hot-pink': '#E91E63',
  grey: '#9E9E9E',
} as const;

type ColorName = keyof typeof COLORS;

/**
 * Shape ID mapping: App picker names ↔ Product catalog IDs
 * 
 * App Picker (9 shapes from screenshots):
 * - blob, circle, vertical-oval, rounded-square, horizontal-pill, 
 *   rounded-triangle, hexagon, cloud, teardrop
 * 
 * Product Catalog IDs (~18 total):
 * - blob, pebble, bean, egg, squircle, tablet, capsule, cylinder, hex,
 *   gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf
 */
const SHAPE_ID_MAP = {
  // App picker → Product ID mapping
  'blob': 'blob',              // Organic brand (foil/Railway hero)
  'circle': 'egg',             // Round ≈ egg
  'vertical-oval': 'bean',     // Tall oval ≈ bean
  'rounded-square': 'squircle',// Squircle
  'horizontal-pill': 'capsule',// Wide capsule
  'rounded-triangle': 'wedge', // Triangle ≈ wedge
  'hexagon': 'hex',            // True geometric hex
  'cloud': 'cloud',            // 3-lobe cloud
  'teardrop': 'teardrop',      // Teardrop
} as const;

type PickerShape = keyof typeof SHAPE_ID_MAP;
type ProductID = typeof SHAPE_ID_MAP[PickerShape];

/**
 * Recipe weights: Per-shape eye scale from GROK_BOT_RECIPE_*
 * Source: product mechanism research
 */
const EYE_SCALE_WEIGHTS: Record<ProductID, number> = {
  blob: 0.92,
  egg: 0.96,      // pebble:.96, using for circle/egg
  bean: 0.96,     // estimated for vertical oval
  squircle: 0.84,
  capsule: 1.0,   // tablet:1, using for horizontal-pill/capsule
  wedge: 0.94,
  hex: 0.94,
  cloud: 1.0,
  teardrop: 1.0,
};

/**
 * Face params: position/scale/offset for eye computation per shape
 * Tuned from app picker screenshots
 */
interface FaceParams {
  // Base eye position (center point for eye pair)
  centerX: number;
  centerY: number;
  
  // Eye pair spacing
  eyeSpacing: number;
  
  // Base eye dimensions (before recipe weight scaling)
  baseRX: number;
  baseRY: number;
  
  // Eye rotation (slant angle)
  rotation: number;
  
  // Left eye offset adjustment (leftDX from product)
  leftDX?: number;
  leftDY?: number;
  
  // Right eye offset adjustment
  rightDX?: number;
  rightDY?: number;
}

/**
 * Face layout per shape (GROK_BOT_RECIPE_FACE_TUNE equivalent)
 * These params drive eye path d computation
 */
const FACE_LAYOUTS: Record<ProductID, FaceParams> = {
  // Blob: Brand overflow eyes
  blob: {
    centerX: 112,
    centerY: 72,
    eyeSpacing: 35,
    baseRX: 8.5,
    baseRY: 17,
    rotation: -25,
    leftDX: -5,
    leftDY: 3,
    rightDX: 6,
    rightDY: -4,
  },
  
  // Egg (circle): Positioned at top
  egg: {
    centerX: 108,
    centerY: 65,
    eyeSpacing: 39,
    baseRX: 7.3,
    baseRY: 14.5,
    rotation: -20,
    leftDX: -4,
    leftDY: 3,
    rightDX: 4,
    rightDY: -3,
  },
  
  // Bean (vertical oval): Narrower eyes for tall shape
  bean: {
    centerX: 108,
    centerY: 68,
    eyeSpacing: 31,
    baseRX: 6.3,
    baseRY: 12.5,
    rotation: -22,
    leftDX: -4,
    leftDY: 2,
    rightDX: 3,
    rightDY: -3,
  },
  
  // Squircle: Centered higher
  squircle: {
    centerX: 108,
    centerY: 73,
    eyeSpacing: 35,
    baseRX: 8.3,
    baseRY: 15.5,
    rotation: -20,
    leftDX: -4,
    leftDY: 2,
    rightDX: 4,
    rightDY: -3,
  },
  
  // Capsule (horizontal pill): Wide spacing for wide shape
  capsule: {
    centerX: 95,
    centerY: 83,
    eyeSpacing: 40,
    baseRX: 6,
    baseRY: 12,
    rotation: -18,
    leftDX: -5,
    leftDY: 2,
    rightDX: 5,
    rightDY: -3,
  },
  
  // Wedge (rounded triangle): Near top point
  wedge: {
    centerX: 107,
    centerY: 66,
    eyeSpacing: 30,
    baseRX: 6.4,
    baseRY: 12.8,
    rotation: -25,
    leftDX: -4,
    leftDY: 2,
    rightDX: 3,
    rightDY: -3,
  },
  
  // Hex (geometric hexagon): Positioned for hex geometry
  hex: {
    centerX: 107,
    centerY: 73,
    eyeSpacing: 37,
    baseRX: 7.4,
    baseRY: 13.8,
    rotation: -22,
    leftDX: -5,
    leftDY: 2,
    rightDX: 5,
    rightDY: -3,
  },
  
  // Cloud: Positioned on cloud form
  cloud: {
    centerX: 102,
    centerY: 70,
    eyeSpacing: 33,
    baseRX: 6,
    baseRY: 12,
    rotation: -20,
    leftDX: -4,
    leftDY: 2,
    rightDX: 4,
    rightDY: -2,
  },
  
  // Teardrop: Near rounded top
  teardrop: {
    centerX: 107,
    centerY: 70,
    eyeSpacing: 30,
    baseRX: 6,
    baseRY: 11.5,
    rotation: -20,
    leftDX: -4,
    leftDY: 2,
    rightDX: 4,
    rightDY: -2,
  },
};

/**
 * Official organic blob head path
 */
const BLOB_HEAD_PATH = 'M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z';

/**
 * Body shape paths (silhouettes only, eyes computed separately)
 */
const SHAPES: Record<ProductID, string> = {
  blob: BLOB_HEAD_PATH,
  
  egg: (() => {
    const cx = CENTER;
    const cy = CENTER;
    const r = 95;
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
  })(),
  
  bean: (() => {
    const cx = CENTER;
    const cy = CENTER;
    const rx = 70;
    const ry = 105;
    return `M ${cx - rx},${cy} A ${rx},${ry} 0 1,1 ${cx + rx},${cy} A ${rx},${ry} 0 1,1 ${cx - rx},${cy} Z`;
  })(),
  
  squircle: (() => {
    const size = 170;
    const x = CENTER - size / 2;
    const y = CENTER - size / 2;
    const r = size * 0.22;
    return `M ${x + r},${y} L ${x + size - r},${y} Q ${x + size},${y} ${x + size},${y + r} L ${x + size},${y + size - r} Q ${x + size},${y + size} ${x + size - r},${y + size} L ${x + r},${y + size} Q ${x},${y + size} ${x},${y + size - r} L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
  })(),
  
  capsule: (() => {
    const cx = CENTER;
    const cy = CENTER;
    const width = 150;
    const height = 80;
    const r = height / 2;
    const left = cx - width / 2;
    const right = cx + width / 2;
    const top = cy - r;
    const bottom = cy + r;
    return `M ${left + r},${top} L ${right - r},${top} A ${r},${r} 0 0,1 ${right - r},${bottom} L ${left + r},${bottom} A ${r},${r} 0 0,1 ${left + r},${top} Z`;
  })(),
  
  wedge: (() => {
    const size = 180;
    const h = size * 0.866;
    const cx = CENTER;
    const top = CENTER - h * 0.55;
    const bottom = CENTER + h * 0.45;
    const left = cx - size / 2;
    const right = cx + size / 2;
    const r = 18;
    
    return `M ${cx},${top + r} Q ${cx},${top} ${cx + r * 0.7},${top + r * 0.7} L ${right - r},${bottom - r} Q ${right},${bottom} ${right - r * 1.5},${bottom} L ${left + r * 1.5},${bottom} Q ${left},${bottom} ${left + r},${bottom - r} L ${cx - r * 0.7},${top + r * 0.7} Q ${cx},${top} ${cx},${top + r} Z`;
  })(),
  
  hex: (() => {
    const size = 90;
    const cx = CENTER;
    const cy = CENTER;
    const h = size * Math.sqrt(3) / 2;
    
    const points = [
      [cx - size, cy],
      [cx - size / 2, cy - h],
      [cx + size / 2, cy - h],
      [cx + size, cy],
      [cx + size / 2, cy + h],
      [cx - size / 2, cy + h],
    ];
    
    return points.map((p, i) => 
      i === 0 ? `M ${p[0]},${p[1]}` : `L ${p[0]},${p[1]}`
    ).join(' ') + ' Z';
  })(),
  
  cloud: (() => {
    const cx = CENTER;
    const cy = CENTER;
    return `M ${cx - 55},${cy + 10} C ${cx - 65},${cy - 30} ${cx - 35},${cy - 50} ${cx - 10},${cy - 40} C ${cx + 5},${cy - 55} ${cx + 35},${cy - 45} ${cx + 45},${cy - 20} C ${cx + 60},${cy - 10} ${cx + 60},${cy + 20} ${cx + 40},${cy + 30} C ${cx + 30},${cy + 40} ${cx - 10},${cy + 40} ${cx - 30},${cy + 30} C ${cx - 50},${cy + 25} ${cx - 55},${cy + 10} ${cx - 55},${cy + 10} Z`;
  })(),
  
  teardrop: (() => {
    const cx = CENTER;
    const bottom = CENTER + 85;
    const top = CENTER - 95;
    const width = 70;
    
    return `M ${cx},${top} C ${cx - width * 0.7},${top + 50} ${cx - width},${bottom - 50} ${cx},${bottom} C ${cx + width},${bottom - 50} ${cx + width * 0.7},${top + 50} ${cx},${top} Z`;
  })(),
};

/**
 * Compute eye path d from face params + recipe weight
 * Models GrokBotMark face layout mechanism
 */
function computeEyePath(
  productID: ProductID,
  side: 'left' | 'right'
): string {
  const face = FACE_LAYOUTS[productID];
  const recipeWeight = EYE_SCALE_WEIGHTS[productID];
  
  // Apply recipe weight to base dimensions
  const rx = face.baseRX * recipeWeight;
  const ry = face.baseRY * recipeWeight;
  
  // Compute eye center position
  const isLeft = side === 'left';
  const spacing = face.eyeSpacing / 2;
  const dx = isLeft ? (face.leftDX || 0) : (face.rightDX || 0);
  const dy = isLeft ? (face.leftDY || 0) : (face.rightDY || 0);
  
  const cx = face.centerX + (isLeft ? -spacing : spacing) + dx;
  const cy = face.centerY + dy;
  
  // Generate ellipse path with rotation
  // Using ellipse element for now; could convert to path d if needed
  return `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="${EYE_FILL}" transform="rotate(${face.rotation} ${cx.toFixed(2)} ${cy.toFixed(2)})"/>`;
}

/**
 * Generate eyes for a shape using face layout computation
 */
function generateEyes(productID: ProductID): string {
  const leftEye = computeEyePath(productID, 'left');
  const rightEye = computeEyePath(productID, 'right');
  
  return `${leftEye}\n    ${rightEye}`;
}

/**
 * Generate complete SVG mark
 */
function generateMark(
  pickerShape: PickerShape,
  color: ColorName,
  options: { pocketPrint?: boolean } = {}
): string {
  const { pocketPrint = false } = options;
  const productID = SHAPE_ID_MAP[pickerShape];
  const fillColor = COLORS[color];
  
  // Pocket print: 192px canvas for ~1.2" @ 300dpi Prodigi placement
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;
  
  const comment = pocketPrint 
    ? `\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->\n  <!-- Product ID: ${productID} (${pickerShape}) -->`
    : `\n  <!-- Grok Bot mark: face layout computation (product ID: ${productID}) -->\n  <!-- Recipe weight: ${EYE_SCALE_WEIGHTS[productID]} | App picker: ${pickerShape} -->`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${comment}
  <g class="grok-bot-mark" data-product-id="${productID}" data-picker-shape="${pickerShape}">
    <path class="grok-bot-mark__head" d="${SHAPES[productID]}" fill="${fillColor}"/>
    <g class="grok-bot-mark__eyes">
      ${generateEyes(productID)}
    </g>
  </g>
</svg>`;
}

/**
 * Generate filename
 */
function getFilename(
  pickerShape: PickerShape,
  color: ColorName,
  pocketPrint = false
): string {
  const prefix = pocketPrint ? 'pocket-' : '';
  return `${prefix}grok-bot-${pickerShape}-${color}.svg`;
}

/**
 * Main generation function
 */
async function generateMarks() {
  const outputDir = join(import.meta.dir, '..', 'assets', 'marks');
  
  await mkdir(outputDir, { recursive: true });
  
  console.log('🤖 Generating Grok Bot character marks (face layout mechanism)...\n');
  
  const pickerShapes = Object.keys(SHAPE_ID_MAP) as PickerShape[];
  const colors = Object.keys(COLORS) as ColorName[];
  
  // Log shape mapping
  console.log('📐 Shape ID Mapping (App Picker ↔ Product Catalog):');
  pickerShapes.forEach(shape => {
    const productID = SHAPE_ID_MAP[shape];
    const weight = EYE_SCALE_WEIGHTS[productID];
    console.log(`   ${shape.padEnd(18)} → ${productID.padEnd(10)} (eye scale: ${weight})`);
  });
  console.log('');
  
  let count = 0;
  
  // Generate all picker shape × color combinations
  for (const shape of pickerShapes) {
    for (const color of colors) {
      const svg = generateMark(shape, color);
      const filename = getFilename(shape, color);
      const filepath = join(outputDir, filename);
      
      await Bun.write(filepath, svg);
      count++;
    }
  }
  
  console.log(`✓ Generated ${count} base marks (9 app picker shapes × 11 colors)`);
  
  // Generate pocket-print brand default (orange blob)
  const pocketSvg = generateMark('blob', 'orange', { pocketPrint: true });
  const pocketFilename = getFilename('blob', 'orange', true);
  const pocketFilepath = join(outputDir, pocketFilename);
  
  await Bun.write(pocketFilepath, pocketSvg);
  console.log(`✓ Generated pocket-print brand default: ${pocketFilename}`);
  
  console.log(`\n✨ Done! Generated ${count + 1} total SVG files in ${outputDir}`);
  console.log(`\n🎯 Brand default (foil/Railway hero): grok-bot-blob-orange.svg`);
  console.log(`🎽 Pocket-print: ${pocketFilename} (~1.2" Prodigi front placement)`);
  console.log(`\n👀 Eyes: Computed from face params (position/scale/leftDX/rightDX) + recipe weights`);
  console.log(`📊 Recipe weights: blob:.92, egg:.96, squircle:.84, capsule:1, wedge:.94, hex:.94, cloud:1, teardrop:1`);
}

// Run the generator
generateMarks().catch(console.error);
