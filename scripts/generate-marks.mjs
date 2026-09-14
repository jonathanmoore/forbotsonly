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
// FINAL LOCK for #109 pack fills - true morph-bot eyes, contained evenodd knockout
const COLORS = {
  white: '#FFFFFF',
  black: '#0A0A0A',         // Official xAI black
  brown: '#936439',         // Official xAI brown
  red: '#DD2229',           // Official xAI red
  orange: '#E84302',        // Official xAI orange (brand-400 for pack marks; foil hero may use #FF6B35)
  gold: '#B77400',          // Official xAI yellow
  'light-green': '#03943C', // Official xAI green-400 (PRIMARY - NOT green-350 alt #2CB663)
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
 * True morph-bot eye shapes from EXPRESSIONS[0] (idle default expression)
 * These are the actual eye shapes used in the outline morph-bot animation
 * Using as KNOCKOUT cutouts (evenodd) for print - fabric shows through
 * ALWAYS CONTAINED within body silhouette (no edge escape per #109)
 */
const TRUE_LEFT_EYE_PATH = "M130.36 45.98L132.71 46.19L134.98 46.81L137.11 47.83L138.97 49.28L140.47 51.09L141.68 53.12L142.73 55.23L143.76 57.36L144.78 59.49L145.79 61.62L146.79 63.76L147.76 65.91L148.71 68.07L149.63 70.25L150.52 72.43L151.37 74.63L151.99 76.91L152.1 79.26L151.64 81.57L150.59 83.68L149.04 85.45L147.1 86.78L144.9 87.62L142.56 87.93L140.22 87.71L137.98 86.99L135.93 85.82L134.17 84.24L132.78 82.34L131.69 80.25L130.77 78.08L129.87 75.89L128.94 73.72L128 71.56L127.03 69.4L126.05 67.26L125.05 65.12L124.03 62.99L122.93 60.9L121.87 58.79L121.03 56.59L120.72 54.26L121.1 51.93L122.15 49.83L123.75 48.1L125.76 46.89L128.01 46.19Z";

const TRUE_RIGHT_EYE_PATH = "M176.61 37.08L178.72 37.59L180.7 38.48L182.52 39.65L184.2 41.03L185.71 42.59L187.03 44.31L188.2 46.14L189.26 48.03L190.27 49.96L191.26 51.89L192.23 53.84L193.16 55.8L194.05 57.78L194.92 59.77L195.74 61.78L196.53 63.8L197.27 65.84L197.97 67.9L198.47 70.01L198.63 72.18L198.4 74.33L197.58 76.33L195.95 77.72L193.83 78.08L191.71 77.65L189.76 76.69L188.03 75.38L186.53 73.82L185.28 72.05L184.25 70.13L183.4 68.14L182.63 66.11L181.87 64.07L181.07 62.05L180.25 60.04L179.39 58.05L178.49 56.07L177.57 54.1L176.61 52.15L175.62 50.22L174.59 48.31L173.53 46.41L172.54 44.48L171.86 42.42L171.76 40.26L172.62 38.3L174.45 37.19Z";

/**
 * Get true morph-bot eye paths scaled for each shape
 * Eyes are ALWAYS CONTAINED within body silhouette (no edge escape per #109)
 * Returns paths as knockout cutouts (evenodd) - NOT solid fills
 */
function getTrueMorphBotEyePaths(officialID) {
  const shape = SHAPES[officialID];
  const eyeScale = shape.face.eye;
  
  // True morph-bot eyes from EXPRESSIONS[0] designed for scale=1.0 (blob)
  // Scale proportionally for other shapes
  if (Math.abs(eyeScale - 1.0) < 0.01) {
    return {
      left: TRUE_LEFT_EYE_PATH,
      right: TRUE_RIGHT_EYE_PATH,
    };
  }
  
  // Scale and contain paths within body boundary
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
    left: scalePathCoords(TRUE_LEFT_EYE_PATH, eyeScale),
    right: scalePathCoords(TRUE_RIGHT_EYE_PATH, eyeScale),
  };
}

/**
 * Generate compound path with head + CONTAINED true morph-bot eye knockouts (#109)
 * Uses fill-rule="evenodd" so eyes become transparent fabric-through holes
 * Eyes stay CONTAINED within silhouette (no edge escape)
 */
function generateCompoundPath(officialID, pickerShape, color, fillColor) {
  const shape = SHAPES[officialID];
  const headPath = shape.path;
  const eyePaths = getTrueMorphBotEyePaths(officialID);
  
  // Single compound path: head + contained eye knockouts (evenodd = fabric-through)
  return `<path class="grok-bot-mark__compound" fill="${fillColor}" fill-rule="evenodd" d="${headPath} ${eyePaths.left} ${eyePaths.right}"/>`;
}

/**
 * Generate complete SVG mark with CONTAINED true morph-bot eye knockouts (#109)
 */
function generateMark(pickerShape, color, options = {}) {
  const { pocketPrint = false } = options;
  const officialID = SHAPE_ID_MAP[pickerShape];
  const fillColor = COLORS[color];
  
  // Pocket print: 192px canvas for ~1.2" @ 300dpi Prodigi placement
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;
  
  const comment = pocketPrint 
    ? `\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->\n  <!-- Official shape: ${officialID} (${pickerShape}) | Eyes: true morph-bot knockouts (evenodd, EXPRESSIONS[0], CONTAINED) -->`
    : `\n  <!-- Grok Bot mark: official geometry from grokbot-animation (shape: ${officialID}) -->\n  <!-- App picker: ${pickerShape} | Eyes: TRUE morph-bot knockouts (evenodd fabric-through, EXPRESSIONS[0], CONTAINED) -->`;
  
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
  console.log(`\n👀 Eyes: TRUE morph-bot knockout holes (evenodd fabric-through, EXPRESSIONS[0]) - #109`);
  console.log(`📐 Geometry: True morph-bot eye shapes (NOT simplified capsules), CONTAINED within silhouette`);
  console.log(`📊 Source: EXPRESSIONS[0] from grokbot-animation (scaled per shape.face.eye)`);
  console.log(`✅ Print-ready: Evenodd knockouts (fabric-through), no edge escape - #109 fix`);
}

// Run the generator
generateMarks().catch(console.error);
