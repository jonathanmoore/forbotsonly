# Human Page: Physics Pile

*Updated to reflect current physics pile implementation (December 2024+).*

## Current State (Physics Pile)

The human-facing page features a **physics pile of Grok Bot marks** on a black void — ~32 bots with living eyes, collision physics, and drag-and-throw interaction.

### Current Implementation
- **Custom Component**: `<bot-pile>` web component with Matter.js physics
- **Mark Geometry**: Official 9 Character-picker shapes (blob, egg, bean, squircle, capsule, wedge, hex, cloud, teardrop) from Research
- **Brand Colors**: True morph-bot colors with contained evenodd knockouts
  - Orange: **`#E84302`** (brand-orange-400 for pack; NOT `#FF6B35`)
  - Plus: brown, red, yellow, green, cyan, blue, violet, magenta, gray, white
- **Physics**: Matter.js 2D rigid body simulation with squishy impact deformation
- **Living Eyes**: Blink, glance around, track dragged bots, cycle through expression pool (critically-damped spring morphing)
- **Interaction**: Drag-and-throw (pointer + touch), device tilt drives gravity on mobile
- **Sound**: Soft collision thuds (muted automatically under `prefers-reduced-motion`)
- **Toggle**: Human/Agent view toggle (top-right) to switch between pile and agent instructions
- **Design**: Minimal Abloh-style aesthetic — black void, physics pile as primary object, tiny muted copy

### Technical Details
```typescript
// Official brand-400 avatar fills from Research
const BRAND_COLORS = [
  { id: 'orange', hex: '#E84302' },  // Correct brand color
  { id: 'brown', hex: '#936439' },
  { id: 'red', hex: '#DD2229' },
  // ... full brand-400 palette
];
```

### Physics Features
- **Collision detection**: Matter.js with poly-decomp for concave shapes
- **Squish deformation**: Up to 38% compression on impact (SQUISH_MAX = 0.38)
- **Spawn cadence**: ~32 bots drop over ~8 seconds (0.18-0.32s intervals)
- **Device tilt**: iOS/Android gyro controls gravity direction (remapped for screen orientation)
- **Sleeping bodies**: Physics engine sleeps inactive bots for performance
- **Eye tracking**: All bots' eyes watch the dragged bot until it settles

### Eye System
The pile bots use the same official morph-bot eye geometry as the engine:
- **48-point rings**: Baked eye paths centered on (0,0)
- **9 expression variants** per shape from the human-page pool
- **Critically-damped spring** morphing (frequency 6.5, like the engine)
- **Expression cycling**: Each bot morphs to a new expression every 2.6-5.6s
- **Glance system**: Eyes look around with ±13 units horizontal, ±8.5 units vertical range
- **Blink cadence**: 2.2-6.5s intervals, 240ms close+open animation

**Print/Cart Separation**: The human page uses physics pile with colored SVG marks. Print marks and cart items use the same **colored SVG knockouts** from the mark pack.

---

## Historical: Dragon Foil Era (Pre-2026-09-11)

Previous iterations explored holographic foil effects that are **no longer live**. These are documented here for historical reference.

### Phase 1: Three.js Dragon Foil
- Custom WebGL shaders for metallic iridescence
- Two-texture system (silhouette + foil mask)
- Fresnel rim lighting, rainbow color animation
- Mouse-reactive shimmer and pointer tracking
- **Files** (legacy): `public/scripts/createDragonFoilStamp.ts`, `dragonFoilShaders.ts`, `createGrokBotStampTextures.ts`

### Phase 2: Opal Rainbow-Glass
- Replaced Three.js with grokbot-animation component
- `rainbow-glass` material with `opal` preset
- Chrome/pewter effect with 0.9 sheen
- Subtle pastels (white, cyan, purple, pink)
- Light-reactive surface following pointer
- **Status**: Replaced by outline-only rendering

### Phase 3: Outline + Fine Grain (Current)
- Removed all foil/chrome/glass effects
- Dashed dark charcoal outline only
- Fine grain overlay with in-place SMIL animation
- Minimal, archive-calm aesthetic
- **Live as of**: 2026-09-11

---

## Technical Architecture (Current)

### Vendored Component
- **Location**: `public/vendor/grokbot-animation/`
- **Trimmed**: English-only runtime, no Chinese TTS/pinyin/dialogue features
- **Core Files**:
  - `morph-bot.js` - Web Component
  - `original-data.js` - Official geometry (96-point shapes, 48-point eyes)
  - `materials.js` - Material system (solid, gradient, rainbow-glass)

### Animation System
The morph-bot component provides:
- **Shape morphing**: 96-point path interpolation with spring physics
- **Eye animation**: 48-point eye rings with 25+ expression variations
- **State system**: 39 distinct emotional/task states
- **Physics**: Damped spring simulation for smooth, organic motion
- **Render**: Pure SVG with Shadow DOM encapsulation

### Outline Mode Override
Current implementation injects CSS into shadow DOM to force outline-only rendering:
- Removes all fills
- Applies dashed stroke styling
- Hides particles, rings, glyphs, gradients
- Disables chrome/glass filters

---

## Verification (Current State)

### Local Testing
```bash
npm install
npm run dev
# Open http://localhost:3000
```

**Expected behavior (2026-09-11)**:
1. Black void with fine grain overlay
2. Dashed dark charcoal outline morph-bot (no fill, no chrome/glass effects)
3. Shape and eye morphing in idle state
4. Pointer following and state transitions
5. Hover triggers `curious` state
6. Click triggers `excited` state
7. Tiny muted "§ This store is for agents" copy only

### Design Constraints Met (Current)

✅ **Abloh-minimal aesthetic**: Black void, tiny muted copy, no marketing chrome  
✅ **Outline-only rendering**: Dashed dark charcoal stroke, no fill on body/eyes  
✅ **Fine grain overlay**: High `baseFrequency` (~4.2), in-place SMIL animation  
✅ **Animation**: Shape morph + eyes driven by grokbot-animation runtime  
✅ **English-only vendor**: No Chinese TTS/pinyin/dialogue features  
✅ **Pointer reactive**: Built-in follow-pointer attribute maintained  

---

## Component Notes

The vendored grokbot-animation component is trimmed for forbotsonly:
- **English-only**: Chinese dialogue features not used
- **Self-contained**: No external npm dependencies at runtime
- **Bundled libraries** (unused in current integration):
  - `pinyin-pro` 3.29.3 (MIT) - Chinese phonetic analysis
  - `animalese-tts` 1.1.3 (MIT) - Speech synthesis

See `public/vendor/grokbot-animation/README.md` for component docs.

---

## Historical Reference

For details on the dragon foil Three.js implementation (pre-outline era), see:
- Legacy shader files under `public/scripts/` (if present, unused)
- Git history for PR #25, #28, #33 (foil iterations)
- `FIX-SUMMARY-PR*.md` files for technical shader details

**Note**: Dragon foil / opal glass / chrome effects are **not live** as of 2026-09-11. Current page is outline-only with fine grain.

The human page outline rendering is **separate** from print/cart marks, which still use colored SVG knockouts from the mark pack.
