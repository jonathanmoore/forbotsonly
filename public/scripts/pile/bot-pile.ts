/**
 * <bot-pile> — playful physics pile of Grok Bot marks.
 *
 * A dozen-plus bots (official mark geometry, brand-400 colors) drop one by
 * one from the top, collide and stack with a squishy-toy deformation on
 * impact. Bots can be dragged and thrown (pointer + touch), device tilt
 * drives gravity on mobile, and eyes blink/glance idly — except while a bot
 * is being dragged, when every other bot's eyes track it.
 *
 * Visual reference: the Grok Bot Austin Texas sidewalk sign.
 */

import Matter from 'matter-js';
import decomp from 'poly-decomp';
import { PILE_SHAPES, MARK_BOX, type PileShape } from './shapes-data';
import { PileSound } from './sound';

Matter.Common.setDecomp(decomp);

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Official brand-400 avatar fills (Research), plus white as an accent. */
const BRAND_COLORS: Array<{ id: string; hex: string }> = [
  { id: 'brown', hex: '#936439' },
  { id: 'red', hex: '#DD2229' },
  { id: 'orange', hex: '#E84302' },
  { id: 'yellow', hex: '#B77400' },
  { id: 'green', hex: '#03943C' },
  { id: 'cyan', hex: '#0093A3' },
  { id: 'blue', hex: '#0E7FCB' },
  { id: 'violet', hex: '#6C6CCB' },
  { id: 'magenta', hex: '#C23B90' },
  { id: 'gray', hex: '#777777' },
  { id: 'white', hex: '#FFFFFF' },
];

const EYE_FILL = '#000000'; // dark slots — knockout look against the void
const BOT_COUNT = 13;
const GLANCE_MAX = 7; // mark units the eye slots may travel when glancing
const SQUISH_MAX = 0.22; // "slight" — still 100% recognizable
const SQUISH_STIFFNESS = 210;
const SQUISH_DAMPING = 13;

interface Bot {
  body: Matter.Body;
  el: SVGGElement;
  eyeEls: SVGGElement[];
  shape: PileShape;
  scale: number;
  com: { x: number; y: number };
  size: number;
  sizeNorm: number;
  // squish spring (q > 0 compresses along squishAngle)
  squish: number;
  squishVel: number;
  squishAngle: number;
  // eyes
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
    const unit = Math.min(Math.max(Math.min(this.viewW, this.viewH) * 0.17, 60), 150);
    const shapes = shuffle(PILE_SHAPES);
    const colors = shuffle(BRAND_COLORS);
    const usedCombos = new Set<string>();

    for (let i = 0; i < BOT_COUNT; i++) {
      const shape = shapes[i % shapes.length];
      // Prefer variety: cycle a shuffled color deck, avoid repeating a
      // shape+color combo when the deck wraps.
      let color = colors[i % colors.length];
      let guard = 0;
      while (usedCombos.has(`${shape.id}/${color.id}`) && guard++ < colors.length) {
        color = colors[(i + guard) % colors.length];
      }
      usedCombos.add(`${shape.id}/${color.id}`);

      // Stratified sizes → guaranteed spread from small to big.
      const f = 0.62 + 0.68 * ((i + Math.random()) / BOT_COUNT);
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
    const y = this.reducedMotion ? rand(this.viewH * 0.3, this.viewH * 0.7) : -r * 2;
    this.addBot(item.shape, item.hex, item.size, x, y);
    this.spawnTimer = this.reducedMotion ? 0 : rand(0.55, 0.85);
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

  private addBot(shape: PileShape, hex: string, size: number, x: number, y: number): void {
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
    Matter.Body.setAngularVelocity(body, rand(-0.08, 0.08));
    Matter.Composite.add(this.engine.world, body);

    // Render group: body path + two eye slot groups, in mark coordinates.
    const el = document.createElementNS(SVG_NS, 'g');
    const bodyPath = document.createElementNS(SVG_NS, 'path');
    bodyPath.setAttribute('d', shape.path);
    bodyPath.setAttribute('fill', hex);
    el.appendChild(bodyPath);

    const eyeEls: SVGGElement[] = [];
    for (const eye of shape.eyes) {
      const eyeGroup = document.createElementNS(SVG_NS, 'g');
      const slot = document.createElementNS(SVG_NS, 'ellipse');
      slot.setAttribute('rx', String(eye.rx));
      slot.setAttribute('ry', String(eye.ry));
      slot.setAttribute('fill', EYE_FILL);
      eyeGroup.appendChild(slot);
      el.appendChild(eyeGroup);
      eyeEls.push(eyeGroup);
    }
    this.svg.appendChild(el);

    const now = performance.now() / 1000;
    const bot: Bot = {
      body,
      el,
      eyeEls,
      shape,
      scale,
      com,
      size,
      sizeNorm: 0,
      squish: 0,
      squishVel: 0,
      squishAngle: Math.PI / 2,
      glance: { x: 0, y: 0 },
      glanceTarget: { x: 0, y: 0 },
      nextGlanceAt: now + rand(0.8, 2.5),
      blinkStart: -1,
      nextBlinkAt: now + rand(1.5, 5),
    };
    this.bots.push(bot);
    this.recomputeSizeNorms();
    for (const part of body.parts) this.botByPartId.set(part.id, bot);
  }

  private recomputeSizeNorms(): void {
    const sizes = this.bots.map((b) => b.size);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    const span = Math.max(1, max - min);
    for (const bot of this.bots) bot.sizeNorm = (bot.size - min) / span;
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
    });
    Matter.Events.on(this.mouseConstraint, 'enddrag', () => {
      this.dragBody = null;
      this.svg.classList.remove('dragging');
    });

    Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of e.pairs) {
        const relVel = Matter.Vector.sub(pair.bodyA.velocity, pair.bodyB.velocity);
        const normal = pair.collision.normal;
        const speed = Math.abs(Matter.Vector.dot(relVel, normal));
        if (speed < 1.4) continue;
        const angle = Math.atan2(normal.y, normal.x);
        let sizeNorm = 0.5;
        let involvedBots = 0;
        for (const part of [pair.bodyA, pair.bodyB]) {
          const bot = this.botByPartId.get(part.id);
          if (!bot) continue;
          bot.squishAngle = angle;
          bot.squishVel += Math.min(0.9, speed * 0.055) * (0.7 + 0.3 * Math.random());
          sizeNorm = bot.sizeNorm;
          involvedBots++;
        }
        if (involvedBots > 0) {
          this.sound.thud(Math.min(1, (speed - 1.4) / 9), sizeNorm);
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
    let gx = Math.min(Math.max(e.gamma / 90, -1), 1); // left/right tilt
    let gy = Math.min(Math.max(e.beta / 90, -1), 1); // front/back tilt

    // Remap for the current screen orientation.
    const angle = (screen.orientation?.angle ?? 0) % 360;
    if (angle === 90) {
      [gx, gy] = [gy, -gx];
    } else if (angle === 270) {
      [gx, gy] = [-gy, gx];
    } else if (angle === 180) {
      [gx, gy] = [-gx, -gy];
    }

    // Near-flat device: settle back to plain downward gravity.
    if (Math.hypot(gx, gy) < 0.18) {
      gx = 0;
      gy = 1;
    }

    this.engine.gravity.x = gx;
    this.engine.gravity.y = gy;

    if (Math.hypot(gx - this.lastGravity.x, gy - this.lastGravity.y) > 0.06) {
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
      this.updateTrackSettle(dt);
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

  private updateTrackSettle(dt: number): void {
    if (!this.trackBody || this.dragBody) return;
    const b = this.trackBody;
    if (b.speed < 0.35 && Math.abs(b.angularSpeed) < 0.03) {
      this.settleTime += dt;
      if (this.settleTime > 0.5) {
        this.trackBody = null;
        this.settleTime = 0;
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
    const ease = Math.min(1, dt * 9);
    for (const bot of this.bots) {
      const tracking = target !== null && bot.body !== target;
      if (tracking && target) {
        const dir = Matter.Vector.sub(target.position, bot.body.position);
        const mag = Matter.Vector.magnitude(dir);
        if (mag > 1) {
          // Rotate world direction into the bot's local (mark) frame.
          const local = Matter.Vector.rotate(dir, -bot.body.angle);
          bot.glanceTarget.x = (local.x / mag) * GLANCE_MAX;
          bot.glanceTarget.y = (local.y / mag) * GLANCE_MAX;
        }
      } else if (now >= bot.nextGlanceAt) {
        // Idle cycle: mostly recenter, sometimes wander.
        if (Math.random() < 0.45) {
          bot.glanceTarget.x = 0;
          bot.glanceTarget.y = 0;
        } else {
          const a = rand(0, Math.PI * 2);
          const r = rand(1.5, GLANCE_MAX * 0.7);
          bot.glanceTarget.x = Math.cos(a) * r;
          bot.glanceTarget.y = Math.sin(a) * r;
        }
        bot.nextGlanceAt = now + rand(1.2, 3.4);
      }
      bot.glance.x += (bot.glanceTarget.x - bot.glance.x) * ease;
      bot.glance.y += (bot.glanceTarget.y - bot.glance.y) * ease;

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
      for (let i = 0; i < bot.eyeEls.length; i++) {
        const eye = bot.shape.eyes[i];
        bot.eyeEls[i].setAttribute(
          'transform',
          `translate(${(eye.cx + bot.glance.x).toFixed(2)} ${(eye.cy + bot.glance.y).toFixed(2)}) rotate(${eye.angle}) scale(1 ${blinkY.toFixed(3)})`,
        );
      }
    }
  }
}

customElements.define('bot-pile', BotPile);
