# Architecture

Morph Bot keeps its public Web Component and engine APIs stable while separating animation concerns into small runtime systems. The runtime remains framework-free ESM and renders only SVG.

## Data flow

```text
catalog.js ───────────────► lab / component editor / API docs
materials.js ─────────────► lab / component editor / API docs / material-system
original-data.js ─────────► GrokBotEngine facade
                                  │
                                  ├── simulation-clock
                                  ├── physics-system ──► math
                                  ├── state-behavior-system ──► geometry + math
                                  ├── morph-system ──► catalog + math
                                  ├── particle-system
                                  ├── material-system
                                  └── svg-renderer ──► geometry + math
```

`component/catalog.js` is the single bilingual source for state groups, state labels, shape labels, Morph labels, ordering, and default state-to-Morph mappings. Extracted source geometry and timing data remain in `component/original-data.js`.

`component/materials.js` is the shared source for material modes and the 8 solid, 8 gradient, and 5 rainbow-glass presets. Editors and docs consume the same definitions used by the renderer, so preset IDs, labels, generated code, and SVG output cannot drift independently.

## Runtime boundaries

| Module | Owns |
|---|---|
| `grok-bot-engine.js` | Stable public facade, DOM references, shared runtime state, and system coordination |
| `runtime/simulation-clock.js` | Playback rate, pause, manual stepping, and simulation-time advancement |
| `runtime/physics-system.js` | Fixed-step spring integration and reduced-motion settling |
| `runtime/math.js` | Easing, random ranges, clamping, and spring primitives |
| `runtime/geometry.js` | Ring interpolation, outline generation, shape turning, spans, and Morph geometry |
| `runtime/state-behavior-system.js` | State poses, gaze, blinking, gestures, shape-change motion, and expression cadence |
| `runtime/morph-system.js` | Morph selection, crossfades, preview lifecycle, and repeated one-shot rest cycles |
| `runtime/particle-system.js` | Burst particles, orbit trails, SVG particle nodes, and cleanup |
| `runtime/material-system.js` | SVG gradient definitions, ordered color stops, rainbow-glass shading layers, and material cleanup |
| `runtime/svg-renderer.js` | Head, eyes, badge, Morph layers, glyphs, and viewBox rendering |

The facade delegates with the engine instance as context. This preserves existing methods such as `updateMorph()`, `renderEyes()`, `pause()`, and `snapshot()` for consumers and regression harnesses while letting each system evolve independently.

## Behavioral contracts

Refactors must keep these contracts green:

- all 1,521 ordered state transitions complete without stale Morph or eye state;
- all 1,800 shape, expression, and eye-open combinations remain inside their outline;
- all 14 Morph effects enter, crossfade, exit, and restore both eyes;
- explicit previews follow `RESET → ENTER → HOLD → EXIT → DONE`;
- `progress` and `spawning` repeat with a rest interval, while persistent state Morphs remain active;
- the downloadable package contains every runtime dependency and has no imports outside its folder.
- every material preset has valid ordered color stops and remains available through the component exports.

Run `npm test` after behavior or rendering changes, and `npm run pack:component` whenever the standalone package version or file graph changes.

---

# 架构说明

Morph Bot 在保持 Web Component 与引擎公共 API 稳定的同时，把动画职责拆成独立运行时系统。整个运行时仍是无框架 ESM，只使用 SVG 渲染。

- `catalog.js` 是状态分组、中英文名称、形状名称、Morph 名称、顺序与默认映射的唯一来源。
- `materials.js` 是纯色、渐变与彩虹玻璃模式、预设和中英文名称的唯一来源。
- `original-data.js` 只保存从参考实现整理出的状态、表情与几何数据。
- `GrokBotEngine` 现在是约 400 行的稳定门面，负责共享状态与系统编排，不再直接承载所有行为和渲染实现。
- 时钟、弹簧物理、状态行为、Morph 生命周期、材质、粒子与 SVG 渲染可以分别测试和演进。

这种边界让后续增加状态、形状或 Morph 时，不必同时修改实验室、组件编辑器和文档三套元数据，也能更快定位“状态切换后眼睛消失”“单次 Morph 不退出”这类跨系统问题。
