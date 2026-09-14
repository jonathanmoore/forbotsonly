/**
 * Generate public/scripts/pile/shapes-data.ts from the vendored
 * grokbot-animation package (the same runtime that powers the outline
 * morph-bot on the human page).
 *
 * Bodies: SHAPES[id].path — byte-identical to the mark-pack body subpaths.
 *
 * Eyes: the morph-bot does NOT use the mark SVG eye subpaths (those are
 * print evenodd knockouts — uniform capsules). Its eyes are the EXPRESSIONS
 * point rings from original-data.js, placed per shape by svg-renderer.js
 * renderEyes(): scaled by shape.face (sx/sy/eye) with a two-eye "fit"
 * factor, vertically clamped to the shape's top/bottom, and horizontally
 * clamped to the shape's span samples. This script bakes that computation
 * at rest (eyes open, no gaze/turn) for every expression in the human-page
 * pool, so the pile renders the same true eye geometry the outline bot
 * shows while cycling idle/curious/playful/happy.
 *
 * Run: bun run scripts/generate-pile-shapes.ts
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Same modules the outline morph-bot loads at /vendor/grokbot-animation/.
// @ts-expect-error vendored JS module without type declarations
import { SHAPES, EXPRESSIONS, HEAD_C, EYE_HALF } from '../public/vendor/grokbot-animation/original-data.js';
// @ts-expect-error vendored JS module without type declarations
import { centroid, shapeSpanAt } from '../public/vendor/grokbot-animation/runtime/geometry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'public/scripts/pile/shapes-data.ts');

type Ring = Array<[number, number]>;

interface AnimShape {
  path: string;
  face: { x: number; y: number; sx: number; sy: number; eye: number };
  top: number;
  bottom: number;
  ring: Ring;
  spanSamples?: Array<[number, number]>;
}

// The 9 app-picker shapes (product IDs). All exist in the animation
// catalog under the same id; `pack` is the mark-pack filename stem kept
// for reference (mark bodies match SHAPES[id].path exactly).
const PICKER_SHAPES: Array<{ id: string; pack: string }> = [
  { id: 'blob', pack: 'blob' },
  { id: 'egg', pack: 'circle' },
  { id: 'bean', pack: 'vertical-oval' },
  { id: 'squircle', pack: 'rounded-square' },
  { id: 'capsule', pack: 'horizontal-pill' },
  { id: 'wedge', pack: 'rounded-triangle' },
  { id: 'hex', pack: 'hexagon' },
  { id: 'cloud', pack: 'cloud' },
  { id: 'teardrop', pack: 'teardrop' },
];

// The human page cycles the outline bot through idle/curious/playful/happy
// states. This is the union of those states' expression pools (all open-eye
// faces): quotes, tall pills, circle+circle, circle+bigger-circle, etc.
// Index 0 (neutral idle quotes, the engine default) is listed first.
const EXPRESSION_POOL = [0, 8, 3, 21, 15, 2, 17, 11, 19];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface EyeSpec {
  cx: number;
  cy: number;
  path: string;
}

/**
 * Static replay of svg-renderer.js renderEyes() at rest:
 * expression spring settled (amount 1, pulse 1), eyes open, no wink, no
 * gaze/pointer drift, no head turn, no notification badge.
 */
function computeEyes(shape: AnimShape, expression: number): EyeSpec[] {
  const rings = EXPRESSIONS[expression] as [Ring, Ring];
  const centers = rings.map((ring) => centroid(ring) as [number, number]);
  const face = shape.face;

  let leftHalf = 0;
  let rightHalf = 0;
  for (const point of rings[0]) leftHalf = Math.max(leftHalf, Math.abs(point[0] - centers[0][0]));
  for (const point of rings[1]) rightHalf = Math.max(rightHalf, Math.abs(point[0] - centers[1][0]));
  const distance = Math.abs(centers[1][0] - centers[0][0]) * face.sx;
  const fit = leftHalf + rightHalf > 0.5 ? clamp((distance - 5) / (leftHalf + rightHalf), 0.35, 4) : 4;

  const eyes: EyeSpec[] = [];
  for (let index = 0; index < 2; index += 1) {
    const ring = rings[index];
    const [centerX, centerY] = centers[index];

    const eyeScale = Math.min(face.eye, fit);
    const scaleX = clamp(eyeScale, 0.02, 2.4);
    const scaleY = clamp(eyeScale, 0.02, 2.4);

    const halfHeight = EYE_HALF * scaleY + 2;
    const y = clamp(
      HEAD_C + face.y + (centerY - HEAD_C) * face.sy,
      shape.top + halfHeight,
      shape.bottom - halfHeight,
    );

    // Horizontal containment against the shape outline (span samples).
    let maxLeft = -Infinity;
    let minRight = Infinity;
    for (let point = 0; point < ring.length; point += 2) {
      const scaledX = (ring[point][0] - centerX) * scaleX;
      const sampleY = y + (ring[point][1] - centerY) * scaleY;
      const [left, right] = shapeSpanAt(shape, sampleY) as [number, number];
      maxLeft = Math.max(maxLeft, left - scaledX);
      minRight = Math.min(minRight, right - scaledX);
    }
    const desired = HEAD_C + face.x + (centerX - HEAD_C) * face.sx;
    const finalX = maxLeft <= minRight ? clamp(desired, maxLeft, minRight) : (maxLeft + minRight) / 2;

    // Bake the ring centered on its own origin so the pile can blink
    // (scale Y) and glance (translate) around the eye center, exactly like
    // the morph-bot's translate/scale/translate transform.
    const local = ring.map(([px, py]) => [
      round2((px - centerX) * scaleX),
      round2((py - centerY) * scaleY),
    ]);
    const path = `M${local.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

    eyes.push({ cx: round2(finalX), cy: round2(y), path });
  }
  return eyes;
}

const entries = PICKER_SHAPES.map(({ id, pack }) => {
  const shape = (SHAPES as Record<string, AnimShape>)[id];
  if (!shape) throw new Error(`animation catalog missing shape "${id}"`);
  return {
    id,
    pack,
    path: shape.path,
    eyeVariants: EXPRESSION_POOL.map((expression) => computeEyes(shape, expression)),
  };
});

const lines: string[] = [];
lines.push('// AUTO-GENERATED by scripts/generate-pile-shapes.ts — do not edit by hand.');
lines.push('// Geometry sourced from public/vendor/grokbot-animation/ (the outline');
lines.push('// morph-bot package): bodies are SHAPES[id].path (identical to the mark');
lines.push('// pack bodies), eyes are the neutral-idle EXPRESSIONS rings placed via');
lines.push('// the renderEyes() face transform. Mark box 229x229, center 114.2705.');
lines.push('');
lines.push('export interface PileEye {');
lines.push('  /** eye center in mark coordinates (after face transform + span clamping) */');
lines.push('  cx: number;');
lines.push('  cy: number;');
lines.push('  /** true morph-bot eye ring, centered on (0,0) at final scale */');
lines.push('  path: string;');
lines.push('}');
lines.push('');
lines.push('export interface PileShape {');
lines.push('  /** app-picker product ID (blob, egg, bean, squircle, capsule, wedge, hex, cloud, teardrop) */');
lines.push('  id: string;');
lines.push('  /** mark-pack filename shape (reference only) */');
lines.push('  pack: string;');
lines.push('  /** body outline path in mark coordinates */');
lines.push('  path: string;');
lines.push('  /**');
lines.push('   * True morph-bot eye sets — one [left, right] pair per expression in the');
lines.push('   * human-page pool (idle/curious/playful/happy). Index 0 is neutral idle.');
lines.push('   */');
lines.push('  eyeVariants: PileEye[][];');
lines.push('}');
lines.push('');
lines.push('export const MARK_CENTER = 114.2705;');
lines.push('export const MARK_BOX = 229;');
lines.push('');
lines.push('export const PILE_SHAPES: PileShape[] = [');
for (const e of entries) {
  lines.push('  {');
  lines.push(`    id: ${JSON.stringify(e.id)},`);
  lines.push(`    pack: ${JSON.stringify(e.pack)},`);
  lines.push(`    path: ${JSON.stringify(e.path)},`);
  lines.push(`    eyeVariants: [`);
  for (const eyes of e.eyeVariants) {
    lines.push('      [');
    for (const eye of eyes) {
      lines.push(`        { cx: ${eye.cx}, cy: ${eye.cy}, path: ${JSON.stringify(eye.path)} },`);
    }
    lines.push('      ],');
  }
  lines.push(`    ],`);
  lines.push('  },');
}
lines.push('];');
lines.push('');

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, lines.join('\n'));
console.log(
  `Wrote ${OUT_FILE} (${entries.length} shapes x ${EXPRESSION_POOL.length} expressions [${EXPRESSION_POOL.join(', ')}])`,
);
