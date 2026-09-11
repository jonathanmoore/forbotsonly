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
 * Seeded random number generator for stable eye positions
 * Based on shape+color for deterministic randomization
 */
function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Compute randomized eye positions within safe face zone
 * Uses official face parameters from grokbot-animation
 */
function computeEyePositions(officialID, pickerShape, color) {
  const shape = SHAPES[officialID];
  const face = shape.face;
  
  // Create seeded RNG based on shape+color for stable positions
  const seed = (pickerShape + color).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = seededRandom(seed);
  
  // Base eye dimensions from official face parameters
  const baseEyeSpacing = EYE_HALF * 2; // Default spacing between eyes
  const eyeScale = face.eye; // Scale factor from face parameters
  
  // Eye dimensions (slanted oval pills)
  const eyeRX = 7.0 * eyeScale;
  const eyeRY = 14.0 * eyeScale;
  const eyeRotation = -20; // Standard slant angle
  
  // Face center position with official offset
  const faceCenterX = HEAD_C + face.x;
  const faceCenterY = HEAD_C + face.y - 30; // Upper region for eyes
  
  // Safe zone based on face scale parameters
  const safeZoneX = face.sx * 50; // Horizontal safe zone
  const safeZoneY = face.sy * 30; // Vertical safe zone
  
  // Randomize within ±30% of safe zone
  const randomVarianceX = (random() - 0.5) * 0.6;
  const randomVarianceY = (random() - 0.5) * 0.6;
  
  // Compute eye spacing with variance
  const eyeSpacing = (baseEyeSpacing * eyeScale) + (randomVarianceX * safeZoneX * 0.3);
  
  // Compute eye centers
  const leftEyeX = faceCenterX - eyeSpacing / 2 + (randomVarianceX * safeZoneX * 0.2);
  const leftEyeY = faceCenterY + (randomVarianceY * safeZoneY * 0.3);
  
  const rightEyeX = faceCenterX + eyeSpacing / 2 + (randomVarianceX * safeZoneX * 0.2);
  const rightEyeY = faceCenterY + (randomVarianceY * safeZoneY * 0.3);
  
  return {
    left: { cx: leftEyeX, cy: leftEyeY, rx: eyeRX, ry: eyeRY, rotation: eyeRotation },
    right: { cx: rightEyeX, cy: rightEyeY, rx: eyeRX, ry: eyeRY, rotation: eyeRotation },
  };
}

/**
 * Generate SVG path for rotated ellipse eye
 */
function generateEyePath(eye) {
  const { cx, cy, rx, ry, rotation } = eye;
  const rad = (rotation * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);
  
  // Compute ellipse boundary points (top, right, bottom, left)
  const pts = [
    [0, -ry],  // top
    [rx, 0],   // right
    [0, ry],   // bottom
    [-rx, 0],  // left
  ].map(([x, y]) => [
    cx + x * cosR - y * sinR,
    cy + x * sinR + y * cosR,
  ]);
  
  // Build elliptical arc path (4 quarters)
  return `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} A ${rx.toFixed(2)},${ry.toFixed(2)} ${rotation} 0,1 ${pts[1][0].toFixed(2)},${pts[1][1].toFixed(2)} A ${rx.toFixed(2)},${ry.toFixed(2)} ${rotation} 0,1 ${pts[2][0].toFixed(2)},${pts[2][1].toFixed(2)} A ${rx.toFixed(2)},${ry.toFixed(2)} ${rotation} 0,1 ${pts[3][0].toFixed(2)},${pts[3][1].toFixed(2)} A ${rx.toFixed(2)},${ry.toFixed(2)} ${rotation} 0,1 ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} Z`;
}

/**
 * Generate compound path with head + eye knockouts
 * Uses fill-rule="evenodd" so eyes become transparent cutouts
 */
function generateCompoundPath(officialID, pickerShape, color, fillColor) {
  const shape = SHAPES[officialID];
  const headPath = shape.path;
  const eyes = computeEyePositions(officialID, pickerShape, color);
  
  const leftEyePath = generateEyePath(eyes.left);
  const rightEyePath = generateEyePath(eyes.right);
  
  // Combine head + eyes as compound path (evenodd makes eyes transparent)
  return `<path class="grok-bot-mark__compound" fill="${fillColor}" fill-rule="evenodd" d="${headPath} ${leftEyePath} ${rightEyePath}"/>`;
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
    ? `\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->\n  <!-- Official shape: ${officialID} (${pickerShape}) | Eyes: randomized knockout cutouts (evenodd) -->`
    : `\n  <!-- Grok Bot mark: official geometry from grokbot-animation (shape: ${officialID}) -->\n  <!-- App picker: ${pickerShape} | Eyes: randomized contained knockouts (stable seed: ${pickerShape}-${color}) -->`;
  
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
  console.log(`\n👀 Eyes: RANDOMIZED knockout transparent cutouts (fill-rule evenodd) — NOT solid black fills`);
  console.log(`📐 Positioning: CONTAINED inside each shape with stable random variance per shape+color`);
  console.log(`📊 Source: Official geometry from vendor/grokbot-animation/component/original-data.js`);
  console.log(`🔑 Seed: Each shape+color combination has stable eye positions (deterministic randomization)`);
}

// Run the generator
generateMarks().catch(console.error);
