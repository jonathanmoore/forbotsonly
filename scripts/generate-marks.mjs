#!/usr/bin/env node

/**
 * Grok Bot Character Mark Generator
 * Source of truth: vendor/grokbot-animation/component/original-data.js
 * 
 * Eyes: Knockout cutouts (evenodd), randomized position within safe face zone per shape
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SHAPES, HEAD_C, EYE_HALF } from '../vendor/grokbot-animation/component/original-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ViewBox with padding
const VIEWBOX = '-15 -15 259 259';

// Color palette (official xAI Grok Bot avatar hexes: x.ai --color-brand-*-400)
// FINAL LOCK A for #100 pack fills - contained evenodd knockout eyes, NO Material colors
const COLORS = {
  white: '#FFFFFF',
  black: '#0A0A0A',         // Official xAI black
  brown: '#936439',         // Official xAI brown
  red: '#DD2229',           // Official xAI red
  orange: '#E84302',        // Official xAI orange (pack fills; foil hero uses #FF6B35)
  gold: '#B77400',          // Official xAI yellow
  'light-green': '#2CB663', // Official xAI green - brighter/more saturated (NOT Material #4CAF50 or #03943C)
  teal: '#0093A3',          // Official xAI cyan
  blue: '#0E7FCB',          // Official xAI blue
  purple: '#6C6CCB',        // Official xAI violet
  'hot-pink': '#C23B90',    // Official xAI magenta
  grey: '#777777',          // Official xAI gray
};

/**
 * Shape ID mapping: App picker names → Official shape IDs from grokbot-animation
 */
const SHAPE_ID_MAP = {
  'blob': 'blob',              // Organic brand (foil/Railway hero)
  'circle': 'egg',             // Round ≈ egg
  'vertical-oval': 'bean',     // Tall oval ≈ bean
  'rounded-square': 'squircle',// Squircle
  'horizontal-pill': 'capsule',// Wide capsule
  'rounded-triangle': 'wedge', // Triangle ≈ wedge
  'hexagon': 'hex',            // True geometric hex
  'cloud': 'cloud',            // Multi-lobe cloud (official product geometry)
  'teardrop': 'teardrop',      // Teardrop
};


/**
 * Official overflow eye paths from grok-bot-overflow-eyes.svg reference
 * These complex tilted stadium/pill shapes can break the silhouette edge (official geometry)
 * Using as KNOCKOUT cutouts (evenodd) for print - fabric shows through
 */
const OFFICIAL_LEFT_EYE_PATH = "M118.17 70.73L120.45 71.04L122.59 71.76L124.55 72.87L126.18 74.38L127.42 76.24L128.34 78.29L129.10 80.42L129.83 82.57L130.55 84.72L131.27 86.86L131.97 89.02L132.64 91.19L133.29 93.36L133.91 95.55L134.50 97.74L135.05 99.95L135.36 102.23L135.16 104.55L134.41 106.80L133.11 108.84L131.36 110.51L129.28 111.73L127.01 112.45L124.68 112.65L122.41 112.33L120.31 111.51L118.45 110.26L116.93 108.62L115.81 106.69L115.01 104.57L114.39 102.39L113.80 100.19L113.17 98.01L112.52 95.84L111.85 93.66L111.17 91.51L110.47 89.35L109.75 87.20L108.94 85.09L108.17 82.96L107.64 80.75L107.63 78.44L108.31 76.16L109.61 74.14L111.41 72.51L113.54 71.41L115.84 70.83Z";

const OFFICIAL_RIGHT_EYE_PATH = "M179.77 59.76L182.04 60.05L184.10 60.75L185.92 61.77L187.55 63.03L188.95 64.50L190.10 66.16L191.07 67.95L191.90 69.82L192.67 71.74L193.41 73.66L194.13 75.60L194.80 77.56L195.42 79.55L196.02 81.54L196.56 83.57L197.06 85.61L197.50 87.67L197.90 89.77L198.06 91.94L197.82 94.21L197.15 96.51L195.85 98.72L193.75 100.38L191.30 101.01L189.00 100.81L186.99 100.03L185.30 98.85L183.91 97.38L182.84 95.66L182.05 93.76L181.48 91.76L181.00 89.71L180.53 87.64L180.02 85.60L179.48 83.58L178.89 81.58L178.26 79.60L177.60 77.62L176.90 75.68L176.15 73.76L175.36 71.86L174.53 69.98L173.78 68.06L173.41 65.97L173.71 63.70L175.05 61.53L177.32 60.14Z";

/**
 * Get official overflow eye paths scaled for each shape
 * Returns paths as knockout cutouts (evenodd) - NOT solid fills
 */
function getOfficialOverflowEyePaths(officialID) {
  const shape = SHAPES[officialID];
  const eyeScale = shape.face.eye;
  
  // Official eyes designed for scale=1.0 (blob), scale proportionally for other shapes
  if (Math.abs(eyeScale - 1.0) < 0.01) {
    return {
      left: OFFICIAL_LEFT_EYE_PATH,
      right: OFFICIAL_RIGHT_EYE_PATH,
    };
  }
  
  // Scale paths for shapes with different eye scales
  const centerX = HEAD_C;
  const centerY = HEAD_C;
  
  const scalePathCoords = (pathStr, scale) => {
    const coords = pathStr.match(/[\d.]+/g).map(Number);
    const scaled = [];
    
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i];
      const y = coords[i + 1];
      scaled.push((centerX + (x - centerX) * scale).toFixed(2));
      scaled.push((centerY + (y - centerY) * scale).toFixed(2));
    }
    
    let result = 'M' + scaled[0] + ' ' + scaled[1];
    for (let i = 2; i < scaled.length; i += 2) {
      result += 'L' + scaled[i] + ' ' + scaled[i + 1];
    }
    return result + 'Z';
  };
  
  return {
    left: scalePathCoords(OFFICIAL_LEFT_EYE_PATH, eyeScale),
    right: scalePathCoords(OFFICIAL_RIGHT_EYE_PATH, eyeScale),
  };
}

/**
 * Generate compound path with head + official overflow eye knockouts
 * Uses fill-rule="evenodd" so official eye paths become transparent cutouts (fabric-through)
 * Eyes can break silhouette edge (official overflow geometry)
 */
function generateCompoundPath(officialID, pickerShape, color, fillColor) {
  const shape = SHAPES[officialID];
  const headPath = shape.path;
  const eyePaths = getOfficialOverflowEyePaths(officialID);
  
  // Combine head + official overflow eyes as compound path (evenodd makes eyes transparent knockout cutouts)
  return `<path class="grok-bot-mark__compound" fill="${fillColor}" fill-rule="evenodd" d="${headPath} ${eyePaths.left} ${eyePaths.right}"/>`;
}

/**
 * Generate complete SVG mark with knockout eyes
 */
function generateMark(pickerShape, color, options = {}) {
  const { pocketPrint = false } = options;
  const officialID = SHAPE_ID_MAP[pickerShape];
  const fillColor = COLORS[color];
  
  // Pocket print: 192px canvas for ~1.2" @ 300dpi Prodigi placement
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;
  
  const comment = pocketPrint 
    ? `\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->\n  <!-- Official shape: ${officialID} (${pickerShape}) | Eyes: official overflow knockouts (evenodd) -->`
    : `\n  <!-- Grok Bot mark: official geometry from grokbot-animation (shape: ${officialID}) -->\n  <!-- App picker: ${pickerShape} | Eyes: official overflow knockouts (can break silhouette, evenodd fabric-through) -->`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${comment}
  <g class="grok-bot-mark" data-official-id="${officialID}" data-picker-shape="${pickerShape}">
    ${generateCompoundPath(officialID, pickerShape, color, fillColor)}
  </g>
</svg>`;
}

/**
 * Generate filename
 */
function getFilename(pickerShape, color, pocketPrint = false) {
  const prefix = pocketPrint ? 'pocket-' : '';
  return `${prefix}grok-bot-${pickerShape}-${color}.svg`;
}

/**
 * Main generation function
 */
async function generateMarks() {
  const outputDir = join(__dirname, '..', 'assets', 'marks');
  
  await mkdir(outputDir, { recursive: true });
  
  console.log('🤖 Generating Grok Bot character marks (official grokbot-animation geometry)...\n');
  
  const pickerShapes = Object.keys(SHAPE_ID_MAP);
  const colors = Object.keys(COLORS);
  
  // Log shape mapping
  console.log('📐 Shape ID Mapping (App Picker ↔ Official grokbot-animation):');
  pickerShapes.forEach(shape => {
    const officialID = SHAPE_ID_MAP[shape];
    const shapeData = SHAPES[officialID];
    console.log(`   ${shape.padEnd(18)} → ${officialID.padEnd(10)} (face eye scale: ${shapeData.face.eye.toFixed(2)})`);
  });
  console.log('');
  
  let count = 0;
  
  // Generate all picker shape × color combinations
  for (const shape of pickerShapes) {
    for (const color of colors) {
      const svg = generateMark(shape, color);
      const filename = getFilename(shape, color);
      const filepath = join(outputDir, filename);
      
      await writeFile(filepath, svg, 'utf-8');
      count++;
    }
  }
  
  console.log(`✓ Generated ${count} base marks (9 app picker shapes × 11 colors)`);
  
  // Generate pocket-print brand default (orange blob)
  const pocketSvg = generateMark('blob', 'orange', { pocketPrint: true });
  const pocketFilename = getFilename('blob', 'orange', true);
  const pocketFilepath = join(outputDir, pocketFilename);
  
  await writeFile(pocketFilepath, pocketSvg, 'utf-8');
  console.log(`✓ Generated pocket-print brand default: ${pocketFilename}`);
  
  console.log(`\n✨ Done! Generated ${count + 1} total SVG files in ${outputDir}`);
  console.log(`\n🎯 Brand default (foil/Railway hero): grok-bot-blob-orange.svg`);
  console.log(`🎽 Pocket-print: ${pocketFilename} (~1.2" Prodigi front placement)`);
  console.log(`\n👀 Eyes: OFFICIAL OVERFLOW knockout cutouts (fill-rule evenodd) from grok-bot-overflow-eyes.svg`);
  console.log(`📐 Geometry: Tilted stadium/pill eye slots CAN break silhouette (official Grok Bot overflow style)`);
  console.log(`📊 Source: Official overflow-eyes reference + shape geometry from grokbot-animation/original-data.js`);
  console.log(`✅ Print-ready: Knockout cutouts (fabric-through), NOT solid fills — works on all tee colors`);
}

// Run the generator
generateMarks().catch(console.error);
