#!/usr/bin/env bun

/**
 * Grok Bot Character Mark Generator
 * Official overflow eyes design - eyes intentionally protrude past body silhouette
 * Source: x.ai/bot official mark
 */

import { join } from 'path';
import { mkdir } from 'fs/promises';

// Official geometry constants (from x.ai/bot mark)
const VIEWBOX = '-15 -15 259 259'; // Padded to allow eye overflow
const VIEWBOX_SIZE = 229; // Internal coordinate system size
const CENTER = 114.2705; // Center point for transforms

// Official transform for the mark group
const MARK_TRANSFORM = `translate(${CENTER} ${CENTER}) scale(1.040524017467249) translate(${-CENTER} ${-CENTER})`;

// Official eye fill color
const EYE_FILL = '#0A0A0A';

// Color palette (body fills)
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
type ShapeName = 'hexagon' | 'circle' | 'vertical-oval' | 'rounded-square' | 
                 'horizontal-pill' | 'rounded-triangle' | 'cloud' | 'teardrop';

/**
 * Official eye paths from x.ai/bot mark
 * These protrude intentionally past the body silhouette
 */
const EYE_LEFT_PATH = 'M118.17 70.73L120.45 71.04L122.59 71.76L124.55 72.87L126.18 74.38L127.42 76.24L128.34 78.29L129.10 80.42L129.83 82.57L130.55 84.72L131.27 86.86L131.97 89.02L132.64 91.19L133.29 93.36L133.91 95.55L134.50 97.74L135.05 99.95L135.36 102.23L135.16 104.55L134.41 106.80L133.11 108.84L131.36 110.51L129.28 111.73L127.01 112.45L124.68 112.65L122.41 112.33L120.31 111.51L118.45 110.26L116.93 108.62L115.81 106.69L115.01 104.57L114.39 102.39L113.80 100.19L113.17 98.01L112.52 95.84L111.85 93.66L111.17 91.51L110.47 89.35L109.75 87.20L108.94 85.09L108.17 82.96L107.64 80.75L107.63 78.44L108.31 76.16L109.61 74.14L111.41 72.51L113.54 71.41L115.84 70.83Z';

const EYE_RIGHT_PATH = 'M179.77 59.76L182.04 60.05L184.10 60.75L185.92 61.77L187.55 63.03L188.95 64.50L190.10 66.16L191.07 67.95L191.90 69.82L192.67 71.74L193.41 73.66L194.13 75.60L194.80 77.56L195.42 79.55L196.02 81.54L196.56 83.57L197.06 85.61L197.50 87.67L197.90 89.77L198.06 91.94L197.82 94.21L197.15 96.51L195.85 98.72L193.75 100.38L191.30 101.01L189.00 100.81L186.99 100.03L185.30 98.85L183.91 97.38L182.84 95.66L182.05 93.76L181.48 91.76L181.00 89.71L180.53 87.64L180.02 85.60L179.48 83.58L178.89 81.58L178.26 79.60L177.60 77.62L176.90 75.68L176.15 73.76L175.36 71.86L174.53 69.98L173.78 68.06L173.41 65.97L173.71 63.70L175.05 61.53L177.32 60.14Z';

/**
 * Official organic head path (used for hexagon/default hero mark)
 */
const HEAD_ORGANIC_PATH = 'M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z';

/**
 * Generate body shape paths (geometric soft silhouettes for shape variants)
 * All centered at (114.2705, 114.2705) to match official coordinate system
 */
const SHAPES: Record<ShapeName, string> = {
  // Official organic blob for hexagon (hero/default)
  hexagon: HEAD_ORGANIC_PATH,
  
  // Circle - soft round shape
  circle: (() => {
    const cx = CENTER;
    const cy = CENTER;
    const r = 95;
    return `M ${cx - r},${cy} A ${r},${r} 0 1,1 ${cx + r},${cy} A ${r},${r} 0 1,1 ${cx - r},${cy} Z`;
  })(),
  
  // Vertical oval - taller than wide
  'vertical-oval': (() => {
    const cx = CENTER;
    const cy = CENTER;
    const rx = 70;
    const ry = 105;
    return `M ${cx - rx},${cy} A ${rx},${ry} 0 1,1 ${cx + rx},${cy} A ${rx},${ry} 0 1,1 ${cx - rx},${cy} Z`;
  })(),
  
  // Rounded square - squircle-like
  'rounded-square': (() => {
    const size = 170;
    const x = CENTER - size / 2;
    const y = CENTER - size / 2;
    const r = size * 0.22;
    return `M ${x + r},${y} L ${x + size - r},${y} Q ${x + size},${y} ${x + size},${y + r} L ${x + size},${y + size - r} Q ${x + size},${y + size} ${x + size - r},${y + size} L ${x + r},${y + size} Q ${x},${y + size} ${x},${y + size - r} L ${x},${y + r} Q ${x},${y} ${x + r},${y} Z`;
  })(),
  
  // Horizontal pill - wider capsule
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
  
  // Rounded triangle - point up
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
  
  // Cloud - 3-lobe organic shape
  cloud: (() => {
    const cx = CENTER;
    const cy = CENTER;
    // Three overlapping circles merged into cloud shape
    return `M ${cx - 55},${cy + 10} C ${cx - 65},${cy - 30} ${cx - 35},${cy - 50} ${cx - 10},${cy - 40} C ${cx + 5},${cy - 55} ${cx + 35},${cy - 45} ${cx + 45},${cy - 20} C ${cx + 60},${cy - 10} ${cx + 60},${cy + 20} ${cx + 40},${cy + 30} C ${cx + 30},${cy + 40} ${cx - 10},${cy + 40} ${cx - 30},${cy + 30} C ${cx - 50},${cy + 25} ${cx - 55},${cy + 10} ${cx - 55},${cy + 10} Z`;
  })(),
  
  // Teardrop - point up
  teardrop: (() => {
    const cx = CENTER;
    const bottom = CENTER + 85;
    const top = CENTER - 95;
    const width = 70;
    
    return `M ${cx},${top} C ${cx - width * 0.7},${top + 50} ${cx - width},${bottom - 50} ${cx},${bottom} C ${cx + width},${bottom - 50} ${cx + width * 0.7},${top + 50} ${cx},${top} Z`;
  })(),
};

/**
 * Generate complete SVG mark with overflow eyes
 */
function generateMark(
  shape: ShapeName,
  color: ColorName,
  options: { pocketPrint?: boolean } = {}
): string {
  const { pocketPrint = false } = options;
  const fillColor = COLORS[color];
  
  // For pocket print, keep same viewBox but scale canvas to 192px (~2" @ 96dpi)
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;
  
  const comment = pocketPrint 
    ? '\n  <!-- Pocket-print: centered viewBox scaled to 192px (~2" @ 96dpi) -->'
    : '\n  <!-- Official overflow eyes: eyes intentionally protrude past body silhouette -->';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${comment}
  <g class="grok-bot-mark" transform="${MARK_TRANSFORM}">
    <path class="grok-bot-mark__head" d="${SHAPES[shape]}" fill="${fillColor}"/>
    <path class="grok-bot-mark__eye grok-bot-mark__eye--left" d="${EYE_LEFT_PATH}" fill="${EYE_FILL}"/>
    <path class="grok-bot-mark__eye grok-bot-mark__eye--right" d="${EYE_RIGHT_PATH}" fill="${EYE_FILL}"/>
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
  
  console.log('🤖 Generating Grok Bot character marks (official overflow eyes)...\n');
  
  const shapes = Object.keys(SHAPES) as ShapeName[];
  const colors = Object.keys(COLORS) as ColorName[];
  
  let count = 0;
  
  // Generate base set: all shapes × all colors
  for (const shape of shapes) {
    for (const color of colors) {
      const svg = generateMark(shape, color);
      const filename = getFilename(shape, color);
      const filepath = join(outputDir, filename);
      
      await Bun.write(filepath, svg);
      count++;
    }
  }
  
  console.log(`✓ Generated ${count} base marks (all shapes × colors with overflow eyes)`);
  
  // Generate pocket-print hero mark (orange hexagon)
  const pocketSvg = generateMark('hexagon', 'orange', { pocketPrint: true });
  const pocketFilename = getFilename('hexagon', 'orange', true);
  const pocketFilepath = join(outputDir, pocketFilename);
  
  await Bun.write(pocketFilepath, pocketSvg);
  console.log(`✓ Generated pocket-print hero mark: ${pocketFilename}`);
  
  console.log(`\n✨ Done! Generated ${count + 1} total SVG files in ${outputDir}`);
  console.log(`\n🎯 Hero mark: grok-bot-hexagon-orange.svg (official organic blob + overflow eyes)`);
  console.log(`🎽 Pocket-print: ${pocketFilename} (scaled to ~2" @ 96dpi)`);
  console.log(`\n👀 Eyes intentionally protrude past body silhouette (official x.ai/bot design)`);
}

// Run the generator
generateMarks().catch(console.error);
