/**
 * True morph-bot eye geometry for static marks (print + pile).
 *
 * This is a deterministic port of `renderEyes()` from
 * vendor/grokbot-animation/component/runtime/svg-renderer.js — the exact code
 * path the outline morph-bot on the human page uses at runtime. It consumes the
 * same EXPRESSIONS eye rings and the same per-shape `face` transform
 * (x / y / sx / sy / eye), the same anti-overlap `fit`, and the same
 * `shapeSpanAt` horizontal clamp. Animation-only inputs (gaze drift, pointer,
 * blink, wink, notify, turn/morph) are held at their rest values.
 *
 * The runtime keeps eyes inside the head with an SVG clip-path. Print marks are
 * a single evenodd compound path, so a knockout that crossed the body edge
 * would print as ink outside the silhouette. `containEye()` therefore adds a
 * geometric guarantee: every eye vertex (and edge midpoint) must sit at least
 * EDGE_MARGIN inside the body ring, and the two eyes must never overlap.
 */

import { EXPRESSIONS, EYE_HALF, HEAD_C, ORIGINAL_STATE_DATA, SHAPES } from '../../vendor/grokbot-animation/component/original-data.js';
import { centroid, ringPath, shapeSpanAt } from '../../vendor/grokbot-animation/component/runtime/geometry.js';
import { clamp } from '../../vendor/grokbot-animation/component/runtime/math.js';

/** Minimum distance (mark units, 229 box) between any eye vertex and the body edge. */
export const EDGE_MARGIN = 5;
/** Minimum gap between the two eye knockouts so evenodd never re-fills an overlap. */
export const EYE_GAP = 4;

/**
 * Outline morph-bot on the human page cycles idle → curious → playful → happy
 * (public/index.html `idleStates`). The union of those states' expression
 * pools is the set of eye pairs a visitor actually sees on the outline bot;
 * every mark draws its eyes from that set so the pack varies the way the
 * animation does instead of repeating one capsule pair.
 */
export const OUTLINE_STATES = ['idle', 'curious', 'playful', 'happy'];
export const OUTLINE_EXPRESSION_SET = [...new Set(OUTLINE_STATES.flatMap((s) => ORIGINAL_STATE_DATA.EXPRESSION_POOLS[s]))];

/**
 * Per official shape id → EXPRESSIONS index (all drawn from OUTLINE_EXPRESSION_SET).
 * Chosen from a rendered contact sheet so each body gets a pair that reads well
 * on its silhouette. E15 (hard side-glance hugging the edge) is intentionally
 * unused for print.
 */
export const SHAPE_EXPRESSION = {
  blob: 3,       // curious: oval + circle — the outline bot pose in refs/outline-true-eyes.png (brand hero + pocket)
  egg: 21,       // curious: two round eyes
  bean: 19,      // happy: short upright pills
  squircle: 2,   // playful/happy: tall slanted pills, wide open
  capsule: 17,   // playful: small slanted pair
  wedge: 8,      // idle: offset down-left glance
  hex: 11,       // happy: tall wide-open pills
  cloud: 0,      // idle: rest pose slanted pair
  teardrop: 19,  // happy: short upright pills
};

function pointInRing(ring, [px, py]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToRing(ring, [px, py]) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    best = Math.min(best, Math.hypot(px - (ax + dx * t), py - (ay + dy * t)));
  }
  return best;
}

/** Signed distance: positive inside the body, negative outside. */
export function signedDepth(ring, point) {
  const d = distanceToRing(ring, point);
  return pointInRing(ring, point) ? d : -d;
}

function samplePoints(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    out.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return out;
}

/** Minimum depth of an eye polygon inside the body ring (negative = escapes). */
export function minDepth(bodyRing, eyePoly) {
  let m = Infinity;
  for (const p of samplePoints(eyePoly)) m = Math.min(m, signedDepth(bodyRing, p));
  return m;
}

function segmentsIntersect([p1, p2], [p3, p4]) {
  const d = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Smallest distance between two eye polygons (0 if they touch/overlap). */
export function polygonGap(a, b) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect([a[i], a[(i + 1) % a.length]], [b[j], b[(j + 1) % b.length]])) return 0;
    }
  }
  if (pointInRing(b, a[0]) || pointInRing(a, b[0])) return 0;
  let gap = Infinity;
  for (const p of a) gap = Math.min(gap, distanceToRing(b, p));
  for (const p of b) gap = Math.min(gap, distanceToRing(a, p));
  return gap;
}

function transformRing(ring, { cx, cy, x, y, sx, sy }) {
  // Same affine as the runtime: translate(x y) scale(sx sy) translate(-cx -cy)
  return ring.map(([px, py]) => [x + (px - cx) * sx, y + (py - cy) * sy]);
}

/**
 * Deterministic port of runtime renderEyes() at rest.
 * Returns per-eye placements { ring, cx, cy, x, y, sx, sy } in mark coordinates.
 */
export function placeRuntimeEyes(shapeId, expressionIndex) {
  const shape = SHAPES[shapeId];
  if (!shape) throw new Error(`Unknown shape: ${shapeId}`);
  const expression = EXPRESSIONS[expressionIndex];
  if (!expression) throw new Error(`Unknown expression: ${expressionIndex}`);

  const eyeRings = [expression[0], expression[1]];
  const centers = eyeRings.map(centroid);
  const face = shape.face;
  const top = shape.top;
  const bottom = shape.bottom;

  let leftHalf = 0;
  let rightHalf = 0;
  for (const point of eyeRings[0]) leftHalf = Math.max(leftHalf, Math.abs(point[0] - centers[0][0]));
  for (const point of eyeRings[1]) rightHalf = Math.max(rightHalf, Math.abs(point[0] - centers[1][0]));
  const distance = Math.abs(centers[1][0] - centers[0][0]) * face.sx;
  const fit = leftHalf + rightHalf > 0.5 ? clamp((distance - 5) / (leftHalf + rightHalf), 0.35, 4) : 4;

  // Rest values of the animation inputs.
  const pulse = 1;            // expressionSpring settled → 1 + 0.07·sin(π) = 1
  const eyeOpen = 1;
  const eyeScaleSpring = 1;
  const driftX = 0;
  const driftY = 0;

  return [0, 1].map((index) => {
    const ring = eyeRings[index];
    const [centerX, centerY] = centers[index];
    const localCenter = HEAD_C + face.x;
    const offsetX = (centerX - HEAD_C) * face.sx;

    const eyeScale = Math.min(clamp(eyeScaleSpring, 0.2, 2) * face.eye, fit / pulse);
    const scaleX = clamp(eyeScale * pulse, 0.02, 2.4);
    const scaleY = clamp(Math.max(eyeOpen, 0.04) * eyeScale * pulse, 0.02, 2.4);

    const halfHeight = EYE_HALF * scaleY + 2;
    const y = clamp(HEAD_C + face.y + (centerY + driftY - HEAD_C) * face.sy, top + halfHeight, bottom - halfHeight);

    let maxLeft = -Infinity;
    let minRight = Infinity;
    for (let point = 0; point < ring.length; point += 2) {
      const scaledX = (ring[point][0] - centerX) * scaleX;
      const sampleY = y + (ring[point][1] - centerY) * scaleY;
      const [left, right] = shapeSpanAt(shape, sampleY);
      maxLeft = Math.max(maxLeft, left - scaledX);
      minRight = Math.min(minRight, right - scaledX);
    }
    const desired = localCenter + offsetX + driftX * face.sx;
    const finalX = maxLeft <= minRight ? clamp(desired, maxLeft, minRight) : (maxLeft + minRight) / 2;

    return { ring, cx: centerX, cy: centerY, x: finalX, y, sx: scaleX, sy: scaleY };
  });
}

/**
 * Print-safe containment. Nudges an eye toward the body centre and shrinks it
 * (about its own centre) until every sample point is ≥ margin inside the body.
 * Mirrors what the runtime clip-path guarantees visually, but as geometry.
 */
export function containEye(shape, placement, margin = EDGE_MARGIN) {
  const body = shape.ring;
  const bodyCenter = [HEAD_C + shape.face.x, HEAD_C + shape.face.y];
  let p = { ...placement };
  for (let i = 0; i < 400; i++) {
    const poly = transformRing(p.ring, p);
    const depth = minDepth(body, poly);
    if (depth >= margin) return { ...p, poly, depth, adjusted: i > 0 || Boolean(placement.adjusted) };
    // Move a little toward the face centre, shrink a little.
    const dx = bodyCenter[0] - p.x;
    const dy = bodyCenter[1] - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(1, margin - depth);
    p = {
      ...p,
      x: p.x + (dx / len) * step * 0.5,
      y: p.y + (dy / len) * step * 0.5,
      sx: p.sx * 0.985,
      sy: p.sy * 0.985,
    };
  }
  throw new Error(`Could not contain eye inside ${shape.label}`);
}

/** Ensure two contained eyes never touch (evenodd would re-fill the overlap). */
export function separateEyes(shape, eyes, gap = EYE_GAP, margin = EDGE_MARGIN) {
  let [a, b] = eyes;
  for (let i = 0; i < 200; i++) {
    const g = polygonGap(a.poly, b.poly);
    if (g >= gap) return [a, b];
    // Push apart along the centre line and shrink slightly, then re-contain.
    const dir = Math.sign(b.x - a.x) || 1;
    a = containEye(shape, { ...a, x: a.x - dir * 0.5, sx: a.sx * 0.99, sy: a.sy * 0.99 }, margin);
    b = containEye(shape, { ...b, x: b.x + dir * 0.5, sx: b.sx * 0.99, sy: b.sy * 0.99 }, margin);
  }
  throw new Error(`Could not separate eyes inside ${shape.label}`);
}

/**
 * Full pipeline for a static mark: runtime placement → contain → separate.
 * Returns { expression, eyes: [{ poly, path, depth, ... }], gap }.
 */
export function buildMarkEyes(shapeId, expressionIndex = SHAPE_EXPRESSION[shapeId]) {
  const shape = SHAPES[shapeId];
  const placed = placeRuntimeEyes(shapeId, expressionIndex);
  const contained = placed.map((p) => containEye(shape, p));
  const [left, right] = separateEyes(shape, contained);
  const eyes = [left, right].map((eye) => ({ ...eye, path: ringPath(eye.poly) }));
  return { shapeId, expression: expressionIndex, eyes, gap: polygonGap(left.poly, right.poly) };
}

/** Independent audit used by the generator and tests. */
export function auditMarkEyes(shapeId, eyes, margin = EDGE_MARGIN, gap = EYE_GAP) {
  const shape = SHAPES[shapeId];
  const depths = eyes.map((eye) => minDepth(shape.ring, eye.poly));
  const eyeGap = polygonGap(eyes[0].poly, eyes[1].poly);
  return {
    contained: depths.every((d) => d >= margin - 1e-6),
    separated: eyeGap >= gap - 1e-6,
    depths,
    gap: eyeGap,
  };
}
