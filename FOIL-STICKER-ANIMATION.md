# Human Page Evolution: Foil to Outline

## Current State (2026-09-11 Locked)

The human-facing page now features a **dashed dark charcoal outline** of an animated morph-bot on a black void with fine static grain.

### Current Implementation
- **Vendored Component**: `public/vendor/grokbot-animation/` (English-only, no Chinese dialogue)
- **Rendering**: Dashed outline only (`#2a2a2a`, ~1.8px, 8-4 dash pattern), **no fill** on body or eyes
- **Grain Overlay**: Fine SVG fractal noise with `baseFrequency='4.2'`, opacity `0.05`, in-place SMIL seed animation (**no x/y translate**)
- **Animation**: Shape morphing and eye animation from morph-bot component
- **States**: Idle cycling (curious, playful, happy), pointer-reactive
- **Design**: Minimal Abloh-style aesthetic — black void, tiny muted copy, no marketing chrome

### Technical Details
```html
<!-- Outline-only styling injected into shadow DOM -->
.grok-bot-mark__head,
.grok-bot-mark__eye,
.morph-part {
  fill: none !important;
  stroke: #2a2a2a !important;
  stroke-width: 1.8 !important;
  stroke-dasharray: 8 4 !important;
  stroke-linecap: round !important;
}
```

### Fine Grain Overlay
```css
body::before {
  background-image: url("data:image/svg+xml,...
    <feTurbulence 
      type='fractalNoise' 
      baseFrequency='4.2' 
      numOctaves='4' 
      seed='1'>
      <!-- SMIL seed animation: in-place static fuzz, no translate -->
      <animate attributeName='seed' values='1;10;50;...' dur='0.6s' repeatCount='indefinite'/>
    </feTurbulence>
  ...");
  opacity: 0.05;
}
```

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
