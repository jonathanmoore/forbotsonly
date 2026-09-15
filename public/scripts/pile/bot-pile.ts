/**
 * <bot-pile> — playful physics pile of Grok Bot marks.
 *
 * Thirty-odd bots (official mark geometry, brand-400 colors) drop one by
 * one from the top, collide and stack with a squishy-toy deformation on
 * impact. Bots can be dragged and thrown (pointer + touch), device tilt
 * drives gravity on mobile. Eyes are alive like the outline morph-bot's:
 * each bot blinks, glances around, and cycles through the human-page
 * expression pool (idle/curious/playful/happy — EXPRESSIONS indices
 * [0, 8, 3, 21, 15, 2, 17, 11, 19]) with the same critically-damped
 * lerpRing morph the engine uses. While a bot is being dragged, every
 * other bot switches to round eyes and slides them across its body toward
 * the dragged bot (in its own rotated frame) until it settles.
 *
 * Visual reference: the Grok Bot Austin Texas sidewalk sign.
 */

import Matter from 'matter-js';
import decomp from 'poly-decomp';
import { PILE_SHAPES, MARK_BOX, type PileEye, type PileShape } from './shapes-data';
import { PileSound } from './sound';

Matter.Common.setDecomp(decomp);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Official brand-400 avatar fills (Research), split by visual saturation. */
const COLORFUL_COLORS: Array<{ id: string; hex: string }> = [
  { id: 'red', hex: '#DD2229' },
  { id: 'orange', hex: '#E84302' },
  { id: 'yellow', hex: '#B77400' },
  { id: 'green', hex: '#03943C' },
  { id: 'cyan', hex: '#0093A3' },
  { id: 'blue', hex: '#0E7FCB' },
  { id: 'violet', hex: '#6C6CCB' },
  { id: 'magenta', hex: '#C23B90' },
];

const NEUTRAL_COLORS: Array<{ id: string; hex: string }> = [
  { id: 'brown', hex: '#936439' },
  { id: 'gray', hex: '#777777' },
  { id: 'white', hex: '#FFFFFF' },
];

const BRAND_COLORS = [...COLORFUL_COLORS, ...NEUTRAL_COLORS];

const EYE_FILL = '#000000'; // dark slots — knockout look against the void
const BOT_COUNT = 32; // Jonathan wants 2-3x the original ~13
// Eye glance range in mark units. The morph-bot's gaze aim reaches x ±15 /
// y ±9 in the same coordinate space (state-behavior updateAim); we stay a
// touch under so span-clamped edge eyes keep some margin, and clip eyes to
// the body outline so nothing pokes out at the extremes.
const GLANCE_X = 13;
const GLANCE_Y = 8.5;
// Look-at-dragged: an idle glance (±13 mark units ≈ 5px on a phone-size bot)
// is far too subtle to read as a stare, and the baked round-eye pair sits
// left of the mark center anyway. While tracking, the whole eye pair is
// re-anchored on the body's centroid and pushed toward the dragged bot as
// far as the outline allows (see lookReach), which reads unmistakably.
const LOOK_STEP = 6; // reach search resolution (mark units); must stay < eye radius
const LOOK_MAX = 110; // never push further than this (mark units)
const LOOK_MARGIN = 3; // keep this much outline clearance around each eye
const LOOK_BINS = 72; // reach cache resolution (5° per bin)
// Expression morph spring — mirrors the engine's
// stepSpring(expressionSpring, frequency 6-8, damping 1, dt).
const EXPR_FREQ = 6.5;
// Spawn: the whole outline must start above the top edge with this clearance
// (px) so a bot is never visible mid-frame on its first painted frame.
const SPAWN_CLEAR = 12;

/** One baked eye ring, parsed for morphing: 48 points centered on (0,0). */
interface ParsedEye {
  cx: number;
  cy: number;
  /** flat [x0, y0, x1, y1, ...] */
  pts: number[];
  /** ring extent from its center (mark units), for outline containment */
  r: number;
}
const SQUISH_MAX = 0.38; // increased for visibly squishy impacts (was 0.22)
const SQUISH_STIFFNESS = 210;
const SQUISH_DAMPING = 13;

interface Bot {
  body: Matter.Body;
  el: SVGGElement;
  eyeEls: SVGGElement[];
  eyePathEls: SVGPathElement[];
  shape: PileShape;
  scale: number;
  com: { x: number; y: number };
  size: number;
  sizeNorm: number;
  // squish spring (q > 0 compresses along squishAngle)
  squish: number;
  squishVel: number;
  squishAngle: number;
  // eyes: expression morph (like the morph-bot's expressionFrom/To/Spring)
  variant: number;
  eyesFrom: ParsedEye[];
  eyesTo: ParsedEye[];
  exprT: number;
  exprV: number;
  /** false while a morph is animating (render keeps rewriting eye paths) */
  exprSettled: boolean;
  nextExprAt: number;
  // eyes: glance + blink
  glance: { x: number; y: number };
  glanceTarget: { x: number; y: number };
  nextGlanceAt: number;
  blinkStart: number;
  nextBlinkAt: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Parse a baked "Mx yLx y...Z" eye ring into points for morphing. */
function parseEye(eye: PileEye): ParsedEye {
  const pts = eye.path
    .slice(1, -1)
    .split('L')
    .flatMap((pair) => pair.split(' ').map(Number));
  let r = 0;
  for (let i = 0; i < pts.length; i += 2) r = Math.max(r, Math.hypot(pts[i], pts[i + 1]));
  return { cx: eye.cx, cy: eye.cy, pts, r };
}

/** Blend two parsed eyes — same as the engine's lerpRing, plus centers. */
function lerpEye(from: ParsedEye, to: ParsedEye, t: number): ParsedEye {
  return {
    cx: from.cx + (to.cx - from.cx) * t,
    cy: from.cy + (to.cy - from.cy) * t,
    pts: from.pts.map((v, i) => v + (to.pts[i] - v) * t),
    r: from.r + (to.r - from.r) * t,
  };
}

/**
 * Squared distance from (px, py) to the closed polygon's nearest edge. The
 * pile outlines are sampled at 48-72 points, so this is cheap enough to run
 * per tracking bot per frame (and results are cached per direction anyway).
 */
function edgeDistanceSq(poly: Array<{ x: number; y: number }>, px: number, py: number): number {
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((px - a.x) * abx + (py - a.y) * aby) / len2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = px - (a.x + abx * t);
    const dy = py - (a.y + aby * t);
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best;
}

function eyePathD(pts: number[], t: number, to: number[]): string {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] + (to[i] - pts[i]) * t;
    const y = pts[i + 1] + (to[i + 1] - pts[i + 1]) * t;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return `${d}Z`;
}

export class BotPile extends HTMLElement {
  private svg!: SVGSVGElement;
  private measureSvg!: SVGSVGElement;
  private engine!: Matter.Engine;
  private mouseConstraint!: Matter.MouseConstraint;
  private bots: Bot[] = [];
  private botByPartId = new Map<number, Bot>();
  private walls: Matter.Body[] = [];
  private sound = new PileSound();
  private sampleCache = new Map<string, Array<{ x: number; y: number }>>();
  private variantCache = new Map<string, ParsedEye[][]>();
  private lookCache = new Map<string, number>();
  private clipIds = new Map<string, string>();
  private defs!: SVGDefsElement;

  private rafId = 0;
  private lastTime = 0;
  private spawnTimer = 0;
  private spawnQueue: Array<{ shape: PileShape; hex: string; size: number }> = [];
  private dragBody: Matter.Body | null = null;
  private trackBody: Matter.Body | null = null;
  private settleTime = 0;
  private reducedMotion = false;
  private orientationAttached = false;
  private permissionRequested = false;
  private lastGravity = { x: 0, y: 1 };

  private _paused = false;

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    if (this._paused === value) return;
    this._paused = value;
    if (value) {
      this.stopLoop();
    } else if (this.isConnected) {
      this.startLoop();
    }
  }

  get muted(): boolean {
    return this.sound.muted;
  }

  set muted(value: boolean) {
    this.sound.muted = value;
  }

  connectedCallback(): void {
    try {
      this.setup();
    } catch (error) {
      console.error('bot-pile failed to initialize:', error);
      // Upgrade can happen before page listeners attach: flag synchronously,
      // dispatch asynchronously.
      this.dataset.failed = '1';
      setTimeout(() => {
        this.dispatchEvent(new CustomEvent('pile-error', { bubbles: true }));
      }, 0);
    }
  }

  disconnectedCallback(): void {
    this.stopLoop();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('deviceorientation', this.onOrientation);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.mouseConstraint) {
      const mouse = this.mouseConstraint.mouse as unknown as { element: HTMLElement };
      // Matter attaches listeners in Mouse.create; detach via setElement noop is
      // not provided, so just clear the engine.
      void mouse;
    }
    if (this.engine) Matter.Engine.clear(this.engine);
  }

  private setup(): void {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reducedMotion) this.sound.muted = true;

    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        inset: 0;
        display: block;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      svg.stage {
        width: 100%;
        height: 100%;
        display: block;
        cursor: grab;
      }
      svg.stage.dragging { cursor: grabbing; }
      svg.measure {
        position: absolute;
        width: 0;
        height: 0;
        visibility: hidden;
        pointer-events: none;
      }
    `;
    shadow.appendChild(style);

    // Hidden svg used for path length sampling (physics vertices).
    this.measureSvg = document.createElementNS(SVG_NS, 'svg');
    this.measureSvg.setAttribute('class', 'measure');
    this.measureSvg.setAttribute('aria-hidden', 'true');
    shadow.appendChild(this.measureSvg);

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'stage');
    this.svg.setAttribute('aria-hidden', 'true');
    this.defs = document.createElementNS(SVG_NS, 'defs');
    this.svg.appendChild(this.defs);
    shadow.appendChild(this.svg);
    this.syncViewport();

    this.engine = Matter.Engine.create({ enableSleeping: true });
    this.engine.gravity.y = 1;

    this.buildWalls();
    this.setupMouse();
    this.planSpawns();

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    // Unlock audio + request iOS gyro permission on first gesture.
    this.addEventListener('pointerdown', this.onFirstGesture);
    this.attachOrientation();

    if (!this._paused) this.startLoop();
  }

  // ---------------------------------------------------------------- viewport

  private viewW = 0;
  private viewH = 0;

  private syncViewport(): void {
    this.viewW = Math.max(1, window.innerWidth);
    this.viewH = Math.max(1, window.innerHeight);
    this.svg.setAttribute('viewBox', `0 0 ${this.viewW} ${this.viewH}`);
    this.svg.setAttribute('preserveAspectRatio', 'none');
  }

  private buildWalls(): void {
    const { viewW: w, viewH: h } = this;
    const t = 400; // wall thickness
    if (this.walls.length) {
      Matter.Composite.remove(this.engine.world, this.walls);
      this.walls = [];
    }
    const opts: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0.6,
      restitution: 0.1,
      label: 'wall',
    };
    this.walls = [
      Matter.Bodies.rectangle(w / 2, h + t / 2, w * 4, t, opts), // floor
      Matter.Bodies.rectangle(-t / 2, h / 2 - h, t, h * 4, opts), // left
      Matter.Bodies.rectangle(w + t / 2, h / 2 - h, t, h * 4, opts), // right
      Matter.Bodies.rectangle(w / 2, -h * 2.5 - t / 2, w * 4, t, opts), // ceiling (off-screen)
    ];
    Matter.Composite.add(this.engine.world, this.walls);
  }

  private onResize = (): void => {
    this.syncViewport();
    this.buildWalls();
    // Keep bots reachable inside the new viewport.
    for (const bot of this.bots) {
      const r = bot.size / 2;
      const x = Math.min(Math.max(bot.body.position.x, r), this.viewW - r);
      const y = Math.min(bot.body.position.y, this.viewH - r);
      Matter.Body.setPosition(bot.body, { x, y });
      Matter.Sleeping.set(bot.body, false);
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.stopLoop();
    } else if (!this._paused) {
      this.startLoop();
    }
  };

  // ------------------------------------------------------------------ spawns

  private planSpawns(): void {
    // Increased base unit for better mobile visibility (~30% larger than original 32-bot pile).
    const unit = Math.min(Math.max(Math.min(this.viewW, this.viewH) * 0.17, 60), 140);
    const shapes = shuffle(PILE_SHAPES);
    const colorfulShuffled = shuffle(COLORFUL_COLORS);
    const neutralShuffled = shuffle(NEUTRAL_COLORS);
    const usedCombos = new Set<string>();

    for (let i = 0; i < BOT_COUNT; i++) {
      const shape = shapes[i % shapes.length];
      
      // ~70% colorful, ~30% neutral: weighted random selection from shuffled buckets.
      // Natural randomness (not sterile exact count) while biasing toward colorful.
      const isColorful = Math.random() < 0.7;
      const bucket = isColorful ? colorfulShuffled : neutralShuffled;
      let color = bucket[i % bucket.length];
      
      // Prefer variety: avoid repeating a shape+color combo when possible.
      let guard = 0;
      while (usedCombos.has(`${shape.id}/${color.id}`) && guard++ < bucket.length) {
        color = bucket[(i + guard) % bucket.length];
      }
      usedCombos.add(`${shape.id}/${color.id}`);

      // Stratified sizes → guaranteed spread from small to big, all colors get full variety.
      const f = 0.65 + 0.75 * ((i + Math.random()) / BOT_COUNT);
      this.spawnQueue.push({ shape, hex: color.hex, size: unit * f });
    }
    this.spawnQueue = shuffle(this.spawnQueue);
    this.spawnTimer = this.reducedMotion ? 0 : 0.35;
  }

  private spawnNext(): void {
    const item = this.spawnQueue.shift();
    if (!item) return;
    const r = item.size / 2;
    const x = rand(this.viewW * 0.18 + r, this.viewW * 0.82 - r);
    // Spawn clearly above the viewport, staggered in Y for a visible fall-in.
    // Reduced-motion users get the same gentle drop (a 32-bot pop-in that
    // then bursts apart is more motion, not less); only sound/morphs differ.
    const y = -item.size - rand(0, this.viewH * 0.15);
    const bot = this.addBot(item.shape, item.hex, item.size, x, y);
    // Asymmetric outlines (teardrop, wedge) extend unevenly around their
    // centroid: guarantee the entire body sits above the top edge.
    const overshoot = bot.body.bounds.max.y + SPAWN_CLEAR;
    if (overshoot > 0) {
      Matter.Body.setPosition(bot.body, { x, y: bot.body.position.y - overshoot });
    }
    // Faster cadence than the 13-bot pile so ~32 bots land in ~8s.
    this.spawnTimer = this.reducedMotion ? rand(0.1, 0.18) : rand(0.18, 0.32);
  }

  private samplePathPoints(shape: PileShape): Array<{ x: number; y: number }> {
    const cached = this.sampleCache.get(shape.id);
    if (cached) return cached;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', shape.path);
    this.measureSvg.appendChild(path);
    const total = path.getTotalLength();
    const samples = shape.id === 'cloud' ? 72 : 48;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < samples; i++) {
      const p = path.getPointAtLength((total * i) / samples);
      points.push({ x: p.x, y: p.y });
    }
    this.measureSvg.removeChild(path);
    this.sampleCache.set(shape.id, points);
    return points;
  }

  private addBot(shape: PileShape, hex: string, size: number, x: number, y: number): Bot {
    const scale = size / MARK_BOX;
    const points = this.samplePathPoints(shape).map((p) => ({ x: p.x * scale, y: p.y * scale }));
    const com = Matter.Vertices.centre(points);

    const options: Matter.IChamferableBodyDefinition = {
      restitution: 0.28,
      friction: 0.5,
      frictionStatic: 0.7,
      frictionAir: 0.012,
      label: 'bot',
    };
    let body: Matter.Body | undefined;
    try {
      body = Matter.Bodies.fromVertices(x, y, [points], options, true, 0.01, 10);
    } catch {
      body = undefined;
    }
    if (!body) {
      body = Matter.Bodies.circle(x, y, size * 0.47, options);
      com.x = MARK_BOX * 0.5 * scale;
      com.y = MARK_BOX * 0.5 * scale;
    }
    // Matter quirk: when path-sampling noise flags a convex outline as
    // concave and poly-decomp collapses it back to ONE part (capsule, wedge,
    // teardrop), Bodies.fromVertices returns that part at its own local
    // centroid (~size/2, size/2) and silently ignores (x, y) — the bot would
    // pop in at the top-left of the viewport. Place it explicitly.
    Matter.Body.setPosition(body, { x, y });
    Matter.Body.setAngularVelocity(body, rand(-0.08, 0.08));
    Matter.Composite.add(this.engine.world, body);

    // Render group: body path + two eye slot groups, in mark coordinates.
    const el = document.createElementNS(SVG_NS, 'g');
    const bodyPath = document.createElementNS(SVG_NS, 'path');
    bodyPath.setAttribute('d', shape.path);
    bodyPath.setAttribute('fill', hex);
    el.appendChild(bodyPath);

    // True morph-bot eyes: each bot starts on a random expression from the
    // baked human-page pool (neutral quotes, circles, pills, ...) and keeps
    // cycling through the rest over time (see updateEyes). Paths are
    // centered on (0,0) so glance translates and blink scales around each
    // eye's own center (like the morph-bot's translate/scale/translate).
    // Eyes live in a body-clipped layer so big glances never poke outside.
    const eyeLayer = document.createElementNS(SVG_NS, 'g');
    eyeLayer.setAttribute('clip-path', `url(#${this.ensureEyeClip(shape)})`);
    el.appendChild(eyeLayer);

    const variants = this.parsedVariants(shape);
    const variant = Math.floor(Math.random() * variants.length);
    const eyes = shape.eyeVariants[variant];
    const eyeEls: SVGGElement[] = [];
    const eyePathEls: SVGPathElement[] = [];
    for (const eye of eyes) {
      const eyeGroup = document.createElementNS(SVG_NS, 'g');
      eyeGroup.setAttribute('transform', `translate(${eye.cx} ${eye.cy})`);
      const eyePath = document.createElementNS(SVG_NS, 'path');
      eyePath.setAttribute('d', eye.path);
      eyePath.setAttribute('fill', EYE_FILL);
      eyeGroup.appendChild(eyePath);
      eyeLayer.appendChild(eyeGroup);
      eyeEls.push(eyeGroup);
      eyePathEls.push(eyePath);
    }
    this.svg.appendChild(el);

    const now = performance.now() / 1000;
    const bot: Bot = {
      body,
      el,
      eyeEls,
      eyePathEls,
      shape,
      scale,
      com,
      size,
      sizeNorm: 0,
      squish: 0,
      squishVel: 0,
      squishAngle: Math.PI / 2,
      variant,
      eyesFrom: variants[variant],
      eyesTo: variants[variant],
      exprT: 1,
      exprV: 0,
      exprSettled: true,
      nextExprAt: now + rand(1.5, 5),
      glance: { x: 0, y: 0 },
      glanceTarget: { x: 0, y: 0 },
      nextGlanceAt: now + rand(0.8, 2.5),
      blinkStart: -1,
      nextBlinkAt: now + rand(1.5, 5),
    };
    this.bots.push(bot);
    this.recomputeSizeNorms();
    for (const part of body.parts) this.botByPartId.set(part.id, bot);
    return bot;
  }

  private recomputeSizeNorms(): void {
    const sizes = this.bots.map((b) => b.size);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    const span = Math.max(1, max - min);
    for (const bot of this.bots) bot.sizeNorm = (bot.size - min) / span;
  }

  /** All 9 baked expression eye pairs for a shape, parsed once for morphing. */
  private parsedVariants(shape: PileShape): ParsedEye[][] {
    let variants = this.variantCache.get(shape.id);
    if (!variants) {
      variants = shape.eyeVariants.map((pair) => pair.map(parseEye));
      this.variantCache.set(shape.id, variants);
    }
    return variants;
  }

  /** Shared per-shape clipPath (mark coordinates) that contains the eyes. */
  private ensureEyeClip(shape: PileShape): string {
    let id = this.clipIds.get(shape.id);
    if (!id) {
      id = `pile-eyeclip-${shape.id}`;
      const clip = document.createElementNS(SVG_NS, 'clipPath');
      clip.setAttribute('id', id);
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', shape.path);
      clip.appendChild(path);
      this.defs.appendChild(clip);
      this.clipIds.set(shape.id, id);
    }
    return id;
  }

  /**
   * How far (mark units) the eye pair of `variant` can slide from the body's
   * centroid along unit direction `dir` (mark space) with both rings still
   * fully inside the outline. Marches outward in LOOK_STEP increments until
   * an eye would breach the clearance band; since the step is smaller than
   * any eye radius the band can't be skipped, so no point-in-polygon test is
   * needed. Cached per shape/variant/direction bin.
   */
  private lookReach(bot: Bot, variant: number, dir: { x: number; y: number }): number {
    const bin = Math.round((Math.atan2(dir.y, dir.x) / (Math.PI * 2)) * LOOK_BINS);
    const key = `${bot.shape.id}/${variant}/${((bin % LOOK_BINS) + LOOK_BINS) % LOOK_BINS}`;
    const cached = this.lookCache.get(key);
    if (cached !== undefined) return cached;

    // Evaluate at the bin's center so the cached value matches its key.
    const theta = (bin / LOOK_BINS) * Math.PI * 2;
    const dx = Math.cos(theta);
    const dy = Math.sin(theta);
    const outline = this.samplePathPoints(bot.shape);
    const eyes = this.parsedVariants(bot.shape)[variant];
    const pairX = (eyes[0].cx + eyes[1].cx) / 2;
    const pairY = (eyes[0].cy + eyes[1].cy) / 2;
    // Centroid of the mark outline == the body's rotation pivot (com/scale).
    const anchorX = bot.com.x / bot.scale;
    const anchorY = bot.com.y / bot.scale;
    let reach = 0;
    for (let next = LOOK_STEP; next <= LOOK_MAX; next += LOOK_STEP) {
      let fits = true;
      for (const eye of eyes) {
        const px = anchorX + dx * next + (eye.cx - pairX);
        const py = anchorY + dy * next + (eye.cy - pairY);
        const clear = eye.r + LOOK_MARGIN;
        if (edgeDistanceSq(outline, px, py) < clear * clear) {
          fits = false;
          break;
        }
      }
      if (!fits) break;
      reach = next;
    }
    this.lookCache.set(key, reach);
    return reach;
  }

  /** Random pool member different from the bot's current expression. */
  private pickNextVariant(bot: Bot): number {
    const count = bot.shape.eyeVariants.length;
    let next = Math.floor(Math.random() * (count - 1));
    if (next >= bot.variant) next += 1;
    return next;
  }

  /**
   * Start morphing to another expression — the pile equivalent of the
   * engine's setExpression(): freeze the in-flight blend as the new "from",
   * retarget, and relaunch the critically-damped spring.
   */
  private setBotExpression(bot: Bot, variant: number): void {
    if (variant === bot.variant && bot.exprSettled) return;
    const amount = Math.min(Math.max(bot.exprT, 0), 1);
    bot.eyesFrom = bot.eyesFrom.map((from, i) => lerpEye(from, bot.eyesTo[i], amount));
    bot.eyesTo = this.parsedVariants(bot.shape)[variant];
    bot.variant = variant;
    bot.exprT = this.reducedMotion ? 1 : 0;
    bot.exprV = 0;
    bot.exprSettled = false;
  }

  // ------------------------------------------------------------ interactions

  private setupMouse(): void {
    const mouse = Matter.Mouse.create(this as unknown as HTMLElement);
    this.mouseConstraint = Matter.MouseConstraint.create(this.engine, {
      mouse,
      constraint: {
        stiffness: 0.12,
        damping: 0.08,
        render: { visible: false },
      },
    });
    Matter.Composite.add(this.engine.world, this.mouseConstraint);

    Matter.Events.on(this.mouseConstraint, 'startdrag', (e: Matter.IEvent<Matter.MouseConstraint>) => {
      const body = (e as unknown as { body: Matter.Body }).body;
      this.dragBody = body;
      this.trackBody = body;
      this.settleTime = 0;
      this.svg.classList.add('dragging');
      // Being picked up is an event: the grabbed bot swaps expression on the
      // spot, and it holds that face while carried (no mid-drag cycling).
      // Every other bot switches to the round "circle + circle" pair (pool
      // index 2 — the same EXPRESSIONS ring for all shapes) and holds that
      // stare while it tracks; updateTrackSettle hands them back to idle.
      const now = performance.now() / 1000;
      const ROUND_VARIANT = 2;
      for (const bot of this.bots) {
        // Wake sleeping bodies so they immediately respond to collisions.
        Matter.Sleeping.set(bot.body, false);
        if (bot.body === body) {
          this.setBotExpression(bot, this.pickNextVariant(bot));
          bot.nextExprAt = now + rand(2.6, 5.6);
        } else {
          const roundIdx = Math.min(ROUND_VARIANT, bot.shape.eyeVariants.length - 1);
          this.setBotExpression(bot, roundIdx);
        }
      }
    });
    Matter.Events.on(this.mouseConstraint, 'enddrag', () => {
      this.dragBody = null;
      this.svg.classList.remove('dragging');
      // Bots will resume normal expression cycling via updateEyes
    });

    Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
      const now = performance.now() / 1000;
      for (const pair of e.pairs) {
        const relVel = Matter.Vector.sub(pair.bodyA.velocity, pair.bodyB.velocity);
        const normal = pair.collision.normal;
        const speed = Math.abs(Matter.Vector.dot(relVel, normal));
        const threshold = 1.8;
        if (speed < threshold) continue;
        const angle = Math.atan2(normal.y, normal.x);
        let sizeNorm = 0.5;
        let involvedBots = 0;
        for (const part of [pair.bodyA, pair.bodyB]) {
          const bot = this.botByPartId.get(part.id);
          if (!bot) continue;
          bot.squishAngle = angle;
          bot.squishVel += Math.min(0.9, speed * 0.055) * (0.7 + 0.3 * Math.random());
          bot.blinkStart = now;
          sizeNorm = bot.sizeNorm;
          involvedBots++;
        }
        if (involvedBots > 0) {
          const excessSpeed = speed - threshold;
          const intensity = Math.min(1, Math.pow(excessSpeed / 10, 0.8));
          this.sound.thud(intensity, sizeNorm);
        }
      }
    });
  }

  private onFirstGesture = (): void => {
    this.sound.unlock();
    if (!this.permissionRequested) {
      this.permissionRequested = true;
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      if (typeof DOE?.requestPermission === 'function') {
        DOE.requestPermission()
          .then((state) => {
            if (state === 'granted') {
              window.addEventListener('deviceorientation', this.onOrientation);
              this.orientationAttached = true;
            }
          })
          .catch(() => {});
      }
    }
  };

  private attachOrientation(): void {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    // iOS requires a user-gesture permission request (see onFirstGesture);
    // everywhere else we can listen immediately.
    if ('DeviceOrientationEvent' in window && typeof DOE?.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', this.onOrientation);
      this.orientationAttached = true;
    }
  }

  private onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta == null || e.gamma == null) return;
    
    // Raw tilt values (-90 to 90 degrees)
    let gx = Math.min(Math.max(e.gamma / 90, -1), 1); // left/right tilt
    let gy = Math.min(Math.max(e.beta / 90, -1), 1); // front/back tilt

    // Remap for the current screen orientation (works even when orientation is locked)
    // When locked, angle stays constant but gamma/beta still change with physical tilt
    const angle = (screen.orientation?.angle ?? 0) % 360;
    if (angle === 90) {
      // Landscape right: swap and flip
      [gx, gy] = [gy, -gx];
    } else if (angle === 270) {
      // Landscape left: swap and flip opposite
      [gx, gy] = [-gy, gx];
    } else if (angle === 180) {
      // Portrait upside-down: flip both
      [gx, gy] = [-gx, -gy];
    }
    // For angle === 0 (portrait), use gx/gy as-is

    // Near-flat device: settle back to plain downward gravity (reduced threshold)
    if (Math.hypot(gx, gy) < 0.12) {
      gx = 0;
      gy = 1;
    }

    this.engine.gravity.x = gx;
    this.engine.gravity.y = gy;

    // Wake sleeping bodies on significant gravity change (reduced threshold for responsiveness)
    if (Math.hypot(gx - this.lastGravity.x, gy - this.lastGravity.y) > 0.04) {
      this.lastGravity = { x: gx, y: gy };
      for (const bot of this.bots) Matter.Sleeping.set(bot.body, false);
    }
  };

  // -------------------------------------------------------------------- loop

  private startLoop(): void {
    if (this.rafId) return;
    this.lastTime = performance.now();
    const step = (now: number): void => {
      this.rafId = requestAnimationFrame(step);
      const dtMs = Math.min(now - this.lastTime, 34);
      this.lastTime = now;
      const dt = dtMs / 1000;

      if (this.spawnQueue.length) {
        this.spawnTimer -= dt;
        while (this.spawnTimer <= 0 && this.spawnQueue.length) this.spawnNext();
      }

      Matter.Engine.update(this.engine, dtMs);
      this.updateTrackSettle(dt, now / 1000);
      this.updateSquish(dt);
      this.updateEyes(dt, now / 1000);
      this.render();
    };
    this.rafId = requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private updateTrackSettle(dt: number, now: number): void {
    if (!this.trackBody || this.dragBody) return;
    const b = this.trackBody;
    if (b.speed < 0.35 && Math.abs(b.angularSpeed) < 0.03) {
      this.settleTime += dt;
      if (this.settleTime > 0.5) {
        this.trackBody = null;
        this.settleTime = 0;
        // Release → back to idle: watchers drift off the stare and resume
        // cycling expressions on staggered timers (not all at once).
        for (const bot of this.bots) {
          if (bot.body === b) continue;
          bot.glanceTarget.x = 0;
          bot.glanceTarget.y = 0;
          bot.nextGlanceAt = now + rand(0.4, 1.6);
          bot.nextExprAt = now + rand(0.6, 3.2);
        }
      }
    } else {
      this.settleTime = 0;
    }
  }

  private updateSquish(dt: number): void {
    for (const bot of this.bots) {
      if (bot.squish === 0 && bot.squishVel === 0) continue;
      bot.squish += bot.squishVel * dt;
      bot.squishVel += (-SQUISH_STIFFNESS * bot.squish - SQUISH_DAMPING * bot.squishVel) * dt;
      bot.squish = Math.min(Math.max(bot.squish, -SQUISH_MAX * 0.4), SQUISH_MAX);
      if (Math.abs(bot.squish) < 0.0015 && Math.abs(bot.squishVel) < 0.01) {
        bot.squish = 0;
        bot.squishVel = 0;
      }
    }
  }

  private updateEyes(dt: number, now: number): void {
    const target = this.trackBody;
    for (const bot of this.bots) {
      const dragged = this.dragBody !== null && bot.body === this.dragBody;
      const tracking = target !== null && bot.body !== target;
      if (dragged) {
        // The held bot looks straight ahead (like the morph-bot's dragging
        // state recentering its gaze) while everyone else stares at it.
        bot.glanceTarget.x = 0;
        bot.glanceTarget.y = 0;
      } else if (tracking && target) {
        const dir = Matter.Vector.sub(target.position, bot.body.position);
        const mag = Matter.Vector.magnitude(dir);
        if (mag > 1) {
          // World → this bot's mark space. render() draws the mark as
          // translate(pos) · rotate(angle) · translate(-com) · scale, so a
          // world direction maps into mark space through the inverse
          // rotation, R(-angle). Matter's Vector.rotate and SVG rotate()
          // share the same y-down clockwise convention, so this holds for
          // sideways / upside-down watchers alike.
          const local = Matter.Vector.rotate({ x: dir.x / mag, y: dir.y / mag }, -bot.body.angle);
          // Re-anchor the eye pair on the body centroid and push it toward
          // the dragged bot as far as the outline allows. A target that is
          // right on top of us gets a shorter push so the stare doesn't
          // whip around as the direction flips.
          const eyes = bot.eyesTo;
          const pairX = (eyes[0].cx + eyes[1].cx) / 2;
          const pairY = (eyes[0].cy + eyes[1].cy) / 2;
          const reach = this.lookReach(bot, bot.variant, local) * Math.min(1, 0.45 + mag / (bot.size * 1.5));
          bot.glanceTarget.x = bot.com.x / bot.scale + local.x * reach - pairX;
          bot.glanceTarget.y = bot.com.y / bot.scale + local.y * reach - pairY;
        }
      } else if (now >= bot.nextGlanceAt) {
        // Idle looking-around, tuned to the outline bot's curious/playful
        // gaze: deliberate sideways looks with occasional recentering.
        if (Math.random() < 0.25) {
          bot.glanceTarget.x = 0;
          bot.glanceTarget.y = 0;
        } else {
          const side = Math.random() < 0.5 ? -1 : 1;
          bot.glanceTarget.x = side * rand(0.4, 1) * GLANCE_X;
          bot.glanceTarget.y = rand(-0.7, 0.7) * GLANCE_Y;
        }
        bot.nextGlanceAt = now + rand(1.1, 2.9);
      }
      // Snap to the dragged bot faster than the idle drift.
      const ease = Math.min(1, dt * (tracking || dragged ? 14 : 9));
      bot.glance.x += (bot.glanceTarget.x - bot.glance.x) * ease;
      bot.glance.y += (bot.glanceTarget.y - bot.glance.y) * ease;

      // Expression cycling through the human-page pool. The outline bot
      // rotates idle/curious/playful/happy every 3-5s and each state also
      // cycles internally (1.5-4.5s cadences) — net feel: a new face every
      // few seconds. The held bot keeps its face until it's put down, and
      // watchers hold their round stare until the dragged bot settles
      // (updateTrackSettle re-arms their timers).
      if (!dragged && !tracking && now >= bot.nextExprAt) {
        this.setBotExpression(bot, this.pickNextVariant(bot));
        bot.nextExprAt = now + rand(2.6, 5.6);
      }
      if (!bot.exprSettled && bot.exprT !== 1) {
        // Critically-damped spring, two substeps for stability at 30fps.
        const h = dt / 2;
        for (let s = 0; s < 2; s++) {
          bot.exprV += (-2 * EXPR_FREQ * bot.exprV - EXPR_FREQ * EXPR_FREQ * (bot.exprT - 1)) * h;
          bot.exprT += bot.exprV * h;
        }
        if (bot.exprT >= 1 || (Math.abs(1 - bot.exprT) < 0.004 && Math.abs(bot.exprV) < 0.02)) {
          bot.exprT = 1; // render writes the final frame, then marks settled
          bot.exprV = 0;
        }
      }

      if (bot.blinkStart < 0 && now >= bot.nextBlinkAt) {
        bot.blinkStart = now;
        bot.nextBlinkAt = now + rand(2.2, 6.5) + (Math.random() < 0.18 ? -rand(1.8, 2) : 0);
      }
      if (bot.blinkStart >= 0 && now - bot.blinkStart > 0.24) {
        bot.blinkStart = -1;
      }
    }
  }

  private render(): void {
    const now = performance.now() / 1000;
    for (const bot of this.bots) {
      const { body, com, scale } = bot;
      const deg = (body.angle * 180) / Math.PI;
      let t = `translate(${body.position.x.toFixed(2)} ${body.position.y.toFixed(2)})`;
      if (Math.abs(bot.squish) > 0.002) {
        const nDeg = (bot.squishAngle * 180) / Math.PI;
        const along = 1 - bot.squish;
        const across = 1 + bot.squish * 0.72;
        t += ` rotate(${nDeg.toFixed(2)}) scale(${along.toFixed(4)} ${across.toFixed(4)}) rotate(${(-nDeg).toFixed(2)})`;
      }
      t += ` rotate(${deg.toFixed(2)}) translate(${(-com.x).toFixed(2)} ${(-com.y).toFixed(2)}) scale(${scale.toFixed(4)})`;
      bot.el.setAttribute('transform', t);

      // Blink: quick close + open over 240ms.
      let blinkY = 1;
      if (bot.blinkStart >= 0) {
        const p = Math.min(1, (now - bot.blinkStart) / 0.24);
        blinkY = 1 - Math.sin(p * Math.PI) * 0.9;
      }
      const amount = Math.min(Math.max(bot.exprT, 0), 1);
      for (let i = 0; i < bot.eyeEls.length; i++) {
        const from = bot.eyesFrom[i];
        const to = bot.eyesTo[i];
        const cx = from.cx + (to.cx - from.cx) * amount;
        const cy = from.cy + (to.cy - from.cy) * amount;
        // Glance shifts the eye; blink squashes it around its own center.
        bot.eyeEls[i].setAttribute(
          'transform',
          `translate(${(cx + bot.glance.x).toFixed(2)} ${(cy + bot.glance.y).toFixed(2)}) scale(1 ${blinkY.toFixed(3)})`,
        );
        // Rewrite the ring only while a morph is in flight.
        if (!bot.exprSettled) {
          bot.eyePathEls[i].setAttribute('d', eyePathD(from.pts, amount, to.pts));
        }
      }
      if (!bot.exprSettled && bot.exprT === 1) {
        bot.eyesFrom = bot.eyesTo;
        bot.exprSettled = true;
      }
    }
  }
}

customElements.define('bot-pile', BotPile);
