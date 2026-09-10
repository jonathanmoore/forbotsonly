#!/usr/bin/env bun

/**
 * Grok Bot Character Mark Generator
 * Ground truth: Grok Bot app Character picker screenshots
 * 
 * Eyes: Dark slanted pills/capsules, repositioned per shape (not blob paths on all)
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';

// ViewBox with padding for eye overflow
const VIEWBOX = '-15 -15 259 259';
const CENTER = 114.2705;

// Eye style: dark slanted capsules
const EYE_FILL = '#0A0A0A';

// Color palette (from app picker swatches)
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

// Shape names matching app picker + product enums
type ShapeName = 'blob' | 'circle' | 'vertical-oval' | 'rounded-square' | 
                 'horizontal-pill' | 'rounded-triangle' | 'hexagon' | 'cloud' | 'teardrop';

/**
 * Official organic blob head path (from x.ai/bot mark)
 * This is the brand/default shape, NOT the hexagon
 */
const BLOB_HEAD_PATH = 'M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z';

/**
 * Generate body shape paths
 * All centered at (114.2705, 114.2705) for consistency
 */
const SHAPES: Record<ShapeName, string> = {
  // Organic blob (brand/default - Railway hero, foil default)
  blob: BLOB_HEAD_PATH,
  
  // Circle
  circle: (() => {
    const cx = CENTER;
    const cy = CENTER;
    const r = 95;
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
  })(),
  
  // Vertical oval
  'vertical-oval': (() => {
    const cx = CENTER;
    const cy = CENTER;
    const rx = 70;
    const ry = 105;
    return `M ${cx - rx},${cy} A ${rx},${ry} 0 1,1 ${cx + rx},${cy} A ${rx},${ry} 0 1,1 ${cx - rx},${cy} Z`;
  })(),
  
  // Rounded square (squircle)
  'rounded-square': (() => {
    const size = 170;
    const x = CENTER - size / 2;
    const y = CENTER - size / 2;
    const r = size * 0.22;
    return `M ${x + r},${y} L ${x + size - r},${y} Q ${x + size},${y} ${x + size},${y + r} L ${x + size},${y + size - r} Q ${x + size},${y + size} ${x + size - r},${y + size} L ${x + r},${y + size} Q ${x},${y + size} ${x},${y + size - r} L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
  })(),
  
  // Horizontal pill (wide capsule)
  'horizontal-pill': (() => {
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
  
  // Rounded triangle (point up)
  'rounded-triangle': (() => {
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
  
  // Hexagon (TRUE geometric hex, not the blob)
  hexagon: (() => {
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
  
  // Cloud (3-lobe organic)
  cloud: (() => {
    const cx = CENTER;
    const cy = CENTER;
    return `M ${cx - 55},${cy + 10} C ${cx - 65},${cy - 30} ${cx - 35},${cy - 50} ${cx - 10},${cy - 40} C ${cx + 5},${cy - 55} ${cx + 35},${cy - 45} ${cx + 45},${cy - 20} C ${cx + 60},${cy - 10} ${cx + 60},${cy + 20} ${cx + 40},${cy + 30} C ${cx + 30},${cy + 40} ${cx - 10},${cy + 40} ${cx - 30},${cy + 30} C ${cx - 50},${cy + 25} ${cx - 55},${cy + 10} ${cx - 55},${cy + 10} Z`;
  })(),
  
  // Teardrop (point up)
  teardrop: (() => {
    const cx = CENTER;
    const bottom = CENTER + 85;
    const top = CENTER - 95;
    const width = 70;
    
    return `M ${cx},${top} C ${cx - width * 0.7},${top + 50} ${cx - width},${bottom - 50} ${cx},${bottom} C ${cx + width},${bottom - 50} ${cx + width * 0.7},${top + 50} ${cx},${top} Z`;
  })(),
};

/**
 * Eye configurations per shape
 * Dark slanted pills/capsules, positioned/scaled/rotated to work with each silhouette
 * Based on Grok Bot app Character picker screenshots
 */
interface EyeConfig {
  left: { cx: number; cy: number; rx: number; ry: number; rotation: number };
  right: { cx: number; cy: number; rx: number; ry: number; rotation: number };
}

const EYE_CONFIGS: Record<ShapeName, EyeConfig> = {
  // Blob (organic/brand default) - overflow eyes from official design
  blob: {
    left: { cx: 95, cy: 75, rx: 8, ry: 16, rotation: -25 },
    right: { cx: 130, cy: 68, rx: 8, ry: 16, rotation: -25 },
  },
  
  // Circle - eyes at top, slight overflow
  circle: {
    left: { cx: 88, cy: 68, rx: 7, ry: 14, rotation: -20 },
    right: { cx: 127, cy: 62, rx: 7, ry: 14, rotation: -20 },
  },
  
  // Vertical oval - positioned for tall shape
  'vertical-oval': {
    left: { cx: 92, cy: 70, rx: 6, ry: 12, rotation: -22 },
    right: { cx: 123, cy: 65, rx: 6, ry: 12, rotation: -22 },
  },
  
  // Rounded square - centered higher
  'rounded-square': {
    left: { cx: 90, cy: 75, rx: 7, ry: 13, rotation: -20 },
    right: { cx: 125, cy: 70, rx: 7, ry: 13, rotation: -20 },
  },
  
  // Horizontal pill - wide spacing for wide shape
  'horizontal-pill': {
    left: { cx: 75, cy: 85, rx: 6, ry: 12, rotation: -18 },
    right: { cx: 115, cy: 80, rx: 6, ry: 12, rotation: -18 },
  },
  
  // Rounded triangle - near top point
  'rounded-triangle': {
    left: { cx: 92, cy: 68, rx: 6, ry: 12, rotation: -25 },
    right: { cx: 122, cy: 63, rx: 6, ry: 12, rotation: -25 },
  },
  
  // Hexagon (geometric) - positioned for hex geometry
  hexagon: {
    left: { cx: 88, cy: 75, rx: 7, ry: 13, rotation: -22 },
    right: { cx: 125, cy: 70, rx: 7, ry: 13, rotation: -22 },
  },
  
  // Cloud - positioned on cloud form
  cloud: {
    left: { cx: 85, cy: 72, rx: 6, ry: 12, rotation: -20 },
    right: { cx: 118, cy: 68, rx: 6, ry: 12, rotation: -20 },
  },
  
  // Teardrop - near rounded top
  teardrop: {
    left: { cx: 92, cy: 72, rx: 6, ry: 11, rotation: -20 },
    right: { cx: 122, cy: 68, rx: 6, ry: 11, rotation: -20 },
  },
};

/**
 * Generate eye ellipses (dark slanted pills/capsules)
 */
function generateEyes(shape: ShapeName): string {
  const config = EYE_CONFIGS[shape];
  
  const leftEye = `<ellipse cx="${config.left.cx}" cy="${config.left.cy}" rx="${config.left.rx}" ry="${config.left.ry}" fill="${EYE_FILL}" transform="rotate(${config.left.rotation} ${config.left.cx} ${config.left.cy})"/>`;
  const rightEye = `<ellipse cx="${config.right.cx}" cy="${config.right.cy}" rx="${config.right.rx}" ry="${config.right.ry}" fill="${EYE_FILL}" transform="rotate(${config.right.rotation} ${config.right.cx} ${config.right.cy})"/>`;
  
  return `${leftEye}\n    ${rightEye}`;
}

/**
 * Generate complete SVG mark
 */
function generateMark(
  shape: ShapeName,
  color: ColorName,
  options: { pocketPrint?: boolean } = {}
): string {
  const { pocketPrint = false } = options;
  const fillColor = COLORS[color];
  
  // Pocket print: 192px canvas for ~1.2" @ 300dpi Prodigi placement
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;
  
  const comment = pocketPrint 
    ? '\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->'
    : '\n  <!-- Grok Bot mark: dark slanted pill eyes, per-shape placement -->';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${comment}
  <g class="grok-bot-mark">
    <path class="grok-bot-mark__head" d="${SHAPES[shape]}" fill="${fillColor}"/>
    <g class="grok-bot-mark__eyes">
      ${generateEyes(shape)}
    </g>
  </g>
</svg>`;
}

/**
 * Generate filename
 */
function getFilename(
  shape: ShapeName,
  color: ColorName,
  pocketPrint = false
): string {
  const prefix = pocketPrint ? 'pocket-' : '';
  return `${prefix}grok-bot-${shape}-${color}.svg`;
}

/**
 * Main generation function
 */
async function generateMarks() {
  const outputDir = join(import.meta.dir, '..', 'assets', 'marks');
  
  await mkdir(outputDir, { recursive: true });
  
  console.log('🤖 Generating Grok Bot character marks (ground truth: app picker)...\n');
  
  const shapes = Object.keys(SHAPES) as ShapeName[];
  const colors = Object.keys(COLORS) as ColorName[];
  
  let count = 0;
  
  // Generate all shape × color combinations
  for (const shape of shapes) {
    for (const color of colors) {
      const svg = generateMark(shape, color);
      const filename = getFilename(shape, color);
      const filepath = join(outputDir, filename);
      
      await Bun.write(filepath, svg);
      count++;
    }
  }
  
  console.log(`✓ Generated ${count} base marks (9 shapes × 11 colors)`);
  
  // Generate pocket-print brand default (orange blob)
  const pocketSvg = generateMark('blob', 'orange', { pocketPrint: true });
  const pocketFilename = getFilename('blob', 'orange', true);
  const pocketFilepath = join(outputDir, pocketFilename);
  
  await Bun.write(pocketFilepath, pocketSvg);
  console.log(`✓ Generated pocket-print brand default: ${pocketFilename}`);
  
  console.log(`\n✨ Done! Generated ${count + 1} total SVG files in ${outputDir}`);
  console.log(`\n🎯 Brand default (foil/Railway hero): grok-bot-blob-orange.svg`);
  console.log(`🎽 Pocket-print: ${pocketFilename} (~1.2" Prodigi front placement)`);
  console.log(`\n👀 Eyes: Dark slanted pills, repositioned per shape (not blob paths on all)`);
  console.log(`📐 Shapes: blob ≠ hexagon (blob is organic brand default, hexagon is geometric)`);
}

// Run the generator
generateMarks().catch(console.error);
