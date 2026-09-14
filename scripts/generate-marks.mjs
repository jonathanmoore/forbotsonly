#!/usr/bin/env node

/**
 * Grok Bot Character Mark Generator
 * Source of truth: vendor/grokbot-animation/component/original-data.js
 *
 * Eyes: true morph-bot eye rings (EXPRESSIONS) placed with the runtime's own
 * renderEyes() math (scripts/lib/morph-bot-eyes.mjs), geometrically contained
 * inside the body, emitted as evenodd knockout cutouts (fabric shows through).
 *
 * Writes byte-identical SVGs to BOTH assets/marks/ (source) and
 * public/images/marks/ (served by store previews / Merch / Prodigi pipeline).
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SHAPES } from '../vendor/grokbot-animation/component/original-data.js';
import { auditMarkEyes, buildMarkEyes, EDGE_MARGIN, SHAPE_EXPRESSION } from './lib/morph-bot-eyes.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Every mark is written to each of these; public/ MUST match assets/ byte-for-byte.
const OUTPUT_DIRS = [
  join(ROOT, 'assets', 'marks'),
  join(ROOT, 'public', 'images', 'marks'),
];

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
 * Eye geometry per official shape, computed once. Each entry is the runtime
 * morph-bot eye pair for that shape's assigned outline expression, placed by the
 * ported renderEyes() math and verified contained + non-overlapping.
 */
const EYES_BY_SHAPE = Object.fromEntries(
  Object.values(SHAPE_ID_MAP).map((officialID) => {
    const built = buildMarkEyes(officialID);
    const audit = auditMarkEyes(officialID, built.eyes);
    if (!audit.contained || !audit.separated) {
      throw new Error(`Eye containment failed for ${officialID}: ${JSON.stringify(audit)}`);
    }
    return [officialID, { ...built, audit }];
  }),
);

/**
 * Generate compound path: head + contained true morph-bot eye knockouts.
 * fill-rule="evenodd" turns the eye rings into transparent fabric-through holes.
 */
function generateCompoundPath(officialID, fillColor) {
  const headPath = SHAPES[officialID].path;
  const { eyes } = EYES_BY_SHAPE[officialID];
  return `<path class="grok-bot-mark__compound" fill="${fillColor}" fill-rule="evenodd" d="${headPath} ${eyes[0].path} ${eyes[1].path}"/>`;
}

/**
 * Generate complete SVG mark with contained true morph-bot eye knockouts (#109)
 */
function generateMark(pickerShape, color, options = {}) {
  const { pocketPrint = false } = options;
  const officialID = SHAPE_ID_MAP[pickerShape];
  const fillColor = COLORS[color];
  const { expression, audit } = EYES_BY_SHAPE[officialID];

  // Pocket print: 192px canvas for ~1.2" @ 300dpi Prodigi placement
  const width = pocketPrint ? 192 : 229;
  const height = pocketPrint ? 192 : 229;

  const eyeNote = `Eyes: morph-bot EXPRESSIONS[${expression}] via runtime renderEyes() placement, evenodd fabric-through knockouts, contained (min edge depth ${Math.min(...audit.depths).toFixed(1)}u ≥ ${EDGE_MARGIN}u)`;
  const comment = pocketPrint
    ? `\n  <!-- Pocket-print: 192px canvas for ~1.2" Prodigi front placement (~360px @ 300dpi) -->\n  <!-- Official shape: ${officialID} (${pickerShape}) | ${eyeNote} -->`
    : `\n  <!-- Grok Bot mark: official geometry from grokbot-animation (shape: ${officialID}) -->\n  <!-- App picker: ${pickerShape} | ${eyeNote} -->`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="${VIEWBOX}" xmlns="http://www.w3.org/2000/svg">${comment}
  <g class="grok-bot-mark" data-official-id="${officialID}" data-picker-shape="${pickerShape}" data-expression="${expression}">
    ${generateCompoundPath(officialID, fillColor)}
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
async function writeMark(filename, svg) {
  await Promise.all(OUTPUT_DIRS.map((dir) => writeFile(join(dir, filename), svg, 'utf-8')));
}

async function generateMarks() {
  await Promise.all(OUTPUT_DIRS.map((dir) => mkdir(dir, { recursive: true })));

  console.log('🤖 Generating Grok Bot character marks (official grokbot-animation geometry)...\n');

  const pickerShapes = Object.keys(SHAPE_ID_MAP);
  const colors = Object.keys(COLORS);

  console.log('📐 Shape ↔ official id ↔ morph-bot expression (eye containment audit):');
  pickerShapes.forEach((shape) => {
    const officialID = SHAPE_ID_MAP[shape];
    const { expression, audit } = EYES_BY_SHAPE[officialID];
    console.log(
      `   ${shape.padEnd(18)} → ${officialID.padEnd(9)} EXPRESSIONS[${String(expression).padEnd(2)}]` +
      ` face.eye=${SHAPES[officialID].face.eye.toFixed(2)}` +
      ` depth=${audit.depths.map((d) => d.toFixed(1)).join('/')}u gap=${audit.gap.toFixed(1)}u`,
    );
  });
  console.log('');

  let count = 0;
  for (const shape of pickerShapes) {
    for (const color of colors) {
      await writeMark(getFilename(shape, color), generateMark(shape, color));
      count++;
    }
  }
  console.log(`✓ Generated ${count} base marks (${pickerShapes.length} app picker shapes × ${colors.length} colors)`);

  const pocketFilename = getFilename('blob', 'orange', true);
  await writeMark(pocketFilename, generateMark('blob', 'orange', { pocketPrint: true }));
  console.log(`✓ Generated pocket-print brand default: ${pocketFilename}`);

  console.log(`\n✨ Done! Generated ${count + 1} SVG files in each of:`);
  for (const dir of OUTPUT_DIRS) console.log(`   ${dir}`);
  console.log(`\n🎯 Brand default (foil/Railway hero): grok-bot-blob-orange.svg`);
  console.log(`🎽 Pocket-print: ${pocketFilename} (~1.2" Prodigi front placement)`);
  console.log(`\n👀 Eyes: true morph-bot EXPRESSIONS rings (${Object.values(SHAPE_EXPRESSION).join(', ')}), one outline expression per shape`);
  console.log(`📐 Placement: runtime renderEyes() port (face x/y/sx/sy/eye, fit, shapeSpanAt clamp) + geometric containment ≥ ${EDGE_MARGIN}u`);
  console.log(`✅ Print-ready: evenodd knockouts (fabric-through), no edge escape, public/ == assets/`);
}

// Run the generator
generateMarks().catch(console.error);
