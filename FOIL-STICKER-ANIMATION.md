# Animated Foil Sticker Integration

## Summary

Replaced the static Three.js dragon foil sticker on the human page with an animated version driven by the `grokbot-animation` component from [iduu/grokbot-animation](https://github.com/iduu/grokbot-animation).

## Changes

### 1. Vendored grokbot-animation Component
- **Location**: `public/vendor/grokbot-animation/`
- Full component runtime including:
  - `morph-bot.js` - Web Component for animated Grok Bot
  - `grok-bot-engine.js` - Animation engine with spring physics
  - `original-data.js` - Official geometry data (shapes, eyes, expressions)
  - `materials.js` - Material system (solid, gradient, rainbow-glass)
  - `runtime/` - Core animation systems (physics, particles, morphing, etc.)

### 2. Updated Human Page (`public/index.html`)
- Removed Three.js foil stamp implementation
- Integrated `<morph-bot>` web component
- Configuration:
  - **State**: `idle` with automatic cycling through `curious`, `playful`, `happy`
  - **Shape**: `blob` (classic Grok Bot silhouette)
  - **Material**: `rainbow-glass` with `opal` preset
  - **Features**: Pointer following, interactive state transitions
  - **Size**: 320px (matches original foil sticker dimensions)

### 3. Material Selection: Opal Glass
The `opal` rainbow-glass preset provides a chrome/holographic foil effect with:
- **Higher sheen** (0.9) for metallic appearance
- **Subtle pastels** (white, light cyan/purple/pink) closer to chrome/pewter
- **Less saturated** than rainbow presets, matches minimal aesthetic
- **Light-reactive** surface that follows pointer movement
- Soft specular highlights similar to foil material

### 4. Interactive Behavior
- **Idle**: Automatically cycles through subtle emotional states (3-5s intervals)
- **Hover**: Switches to `curious` state, pauses cycling
- **Click**: Triggers `excited` state with animation, returns to idle after 1.5s
- **Pointer**: Eyes and form follow cursor across viewport (built-in `follow-pointer` attribute)

## Technical Details

### Animation System
The morph-bot component uses:
- **Shape morphing**: 96-point path interpolation with spring physics
- **Eye animation**: 48-point eye rings with 25+ expression variations
- **State system**: 39 distinct emotional/task states from x.ai reference
- **Physics**: Damped spring simulation for smooth, organic motion
- **Render**: Pure SVG (no WebGL/Canvas) with Shadow DOM encapsulation

### Material System
The `rainbow-glass` material applies:
- Multi-stop gradient with ordered color stops (OKLab interpolation)
- Dynamic environment lighting (highlights, shadows, caustics)
- Rotation-invariant light field (light stays fixed while bot rotates)
- Rim lighting and edge dispersion effects

### CSS Enhancements
```css
#foil-stamp {
  filter: contrast(1.15) brightness(1.05);
}

#foil-stamp morph-bot {
  filter: drop-shadow(0 8px 32px rgba(255, 255, 255, 0.15));
}
```

These filters amplify the chrome/metallic appearance without affecting the minimal page aesthetic.

## Verification

### Local Testing
```bash
npm install
npm run dev
# Open http://localhost:3000
```

**Expected behavior**:
1. Page loads with animated Grok Bot sticker on black void
2. Sticker has holographic opal material (subtle chrome/pewter shimmer)
3. Eyes and shape morph subtly in idle state
4. Pointer movement causes bot to follow cursor
5. Hover triggers `curious` state (wider eyes, slight tilt)
6. Click triggers `excited` state (jumping, rapid animation)

### Railway Preview
The branch is deployed to Railway. Access the preview URL from the Railway dashboard or PR checks.

## Design Constraints Met

✅ **Abloh-minimal aesthetic**: Black void, tiny muted copy, no marketing chrome  
✅ **Foil/holographic vibe**: Prism glass material provides metallic shimmer  
✅ **Animation**: Shape morph + eyes driven by grokbot-animation runtime  
✅ **Pointer reactive**: Built-in `follow-pointer` attribute maintained  
✅ **No regression**: Page structure and minimal UI unchanged  

## Out of Scope

- ❌ Print mark SVG pack (separate PR #53)
- ❌ Stripe/Prodigi/identify endpoints (unchanged)
- ❌ Three.js dragon foil shaders (fully replaced, not augmented)

## Dependencies

The vendored component is self-contained with no external npm dependencies for runtime. It includes:
- `pinyin-pro` 3.29.3 (MIT) - Chinese phonetic analysis for dialogue system
- `animalese-tts` 1.1.3 (MIT) - Speech synthesis for dialogue system

These are only used if the dialogue API is invoked (not used in current integration).

## Future Enhancements

Possible improvements:
1. **Custom chrome material**: Replace rainbow-glass with pure chrome/pewter shader closer to original Three.js foil
2. **Shape selection**: Allow different shapes (hexagon, cloud, pill) via query param or random
3. **State triggers**: Connect bot states to MCP agent events (e.g., `thinking` during purchase flow)
4. **Performance**: Lazy-load component only when sticker enters viewport

## References

- Source component: https://github.com/iduu/grokbot-animation
- Component docs: `public/vendor/grokbot-animation/README.md`
- Material presets: `public/vendor/grokbot-animation/materials.js`
- Original data: `public/vendor/grokbot-animation/original-data.js`
