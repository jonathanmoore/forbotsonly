# Fix Summary: PR #33 - Eliminate Peach by Brightening Metallic Base (Historical)

**Note**: This document describes the dragon foil Three.js shader fix from the historical foil era. The current live page (2026-09-11) uses outline-only rendering with fine grain, not foil effects. See `FOIL-STICKER-ANIMATION.md` for current state.

## Issue #23 QA History
- **PR #25**: Added JM chrome/pewter shader → Still peach
- **PR #28**: Fixed to use mix() blending + bevel normals → Still peach  
- **PR #33**: This PR - Brighten metallic base to eliminate peach

## Root Cause of "Flat Peach" (Why PR #28 Still Failed)

Even though PR #28 correctly used `mix()` instead of `add()`, **the metallic lighting was too dark**:

```glsl
// PR #28 shader values:
vec3 darkPewter = vec3(0.45, 0.44, 0.43);      // Dark gray base
vec3 ambient = chromeColor * 0.3;               // Only 30% brightness

// Result when chromeColor = midSilver (0.75):
ambient = 0.75 * 0.3 = 0.225  // Very dark gray

// Mix calculation:
finalColor = mix(orange #FF6B35, darkGray 0.225, 0.85)
           = 0.15 * (1.0, 0.42, 0.21) + 0.85 * (0.225, 0.225, 0.225)
           = (0.34, 0.25, 0.22)  
           = PEACHY BEIGE ❌
```

**The problem**: Dark gray + orange = peach, even with high blend factor.

## This PR's Solution

### 1. Brighten Chrome Color Palette (+44% base luminance)
```diff
- vec3 darkPewter = vec3(0.45, 0.44, 0.43);    // 45% luminance
+ vec3 darkSilver = vec3(0.65, 0.64, 0.63);    // 65% luminance

- vec3 midSilver = vec3(0.75, 0.76, 0.77);     // 75% luminance  
+ vec3 midSilver = vec3(0.82, 0.83, 0.84);     // 82% luminance

  vec3 brightChrome = vec3(0.96, 0.97, 0.99);  // 96% luminance (brightened)
```

### 2. Significantly Brighten Ambient (+150% multiplier)
```diff
- vec3 ambient = chromeColor * 0.3;   // 30% - too dark
+ vec3 ambient = chromeColor * 0.75;  // 75% - bright silver ✓
```

**Critical fix**: With new values:
```
ambient = 0.82 * 0.75 = 0.615  // Bright silver (61.5% luminance)
mix(orange, brightSilver, 0.92) = (0.56, 0.60, 0.61)  // SILVER ✓
```

### 3. Boost All Lighting Components
- Diffuse: `0.4` → `0.6` (+50%)
- Spec1: `0.8` → `1.0` (+25%)
- Spec2: `0.4` → `0.6` (+50%)
- SpecRim: `0.6` → `0.8` (+33%)
- Fresnel: `0.5` → `0.6` (+20%)

### 4. Increase Foil Opacity
```diff
- foilOpacity = 0.85     // 85% replacement
+ foilOpacity = 0.92     // 92% replacement
```

### 5. Enhance Motion Influence
```diff
- vec2 motionOffset = (vUv - uMouse) * 0.5 + uTilt * 0.3;
+ vec2 motionOffset = (vUv - uMouse) * 0.8 + uTilt * 0.4;

- vec3 lightDir1 = normalize(vec3(motionOffset.x, motionOffset.y, 0.8));
+ vec3 lightDir1 = normalize(vec3(motionOffset.x * 1.2, motionOffset.y * 1.2, 0.7));
```

## Expected Visual Result

### Color (What QA Should See)
- **Base foil areas**: Bright silver (60-80% luminance) — clearly metallic, NOT peach/orange
- **Mid-tones**: Polished silver with subtle variations
- **Highlights**: Brilliant chrome (95%+) — moving with pointer
- **Edges**: Enhanced rim lighting (fresnel)
- **Eyes**: Dark matte slots (unchanged)

### Motion (What QA Should Observe)
1. **Pointer tracking**: Move mouse across page → highlights sweep across foil
2. **Device tilt** (mobile): Tilt phone → lighting shifts
3. **Idle**: Subtle drift when no interaction

### Comparison to Prior Failures
| Aspect | PR #28 (Peach) | PR #33 (Silver) |
|--------|----------------|-----------------|
| Ambient base | 0.225 (dark gray) | 0.615 (bright silver) |
| Chrome palette | 0.45-0.95 | 0.65-0.96 |
| Mixed with orange | Peachy beige | Clear silver |
| Pointer response | Subtle | Obvious sweeping |

## Build Verification

Confirmed in `dist/assets/main-o6IRxZ0S.js`:
- ✓ `ambient = chromeColor * 0.75`
- ✓ `darkSilver = vec3(0.65`
- ✓ `foilOpacity:o=.92`
- ✓ `motionOffset = (vUv - uMouse) * 0.8 + uTilt * 0.4`
- ✓ `motionOffset.x * 1.2, motionOffset.y * 1.2`

## QA Testing Steps (Post-Railway Deployment)

### Visual Test
1. Open live Railway URL
2. **EXPECT**: Silvery/chrome metallic sticker (NOT peach/orange/beige)
3. **CHECK**: Base foil color should be clearly silver (like polished metal)
4. **VERIFY**: Orange only visible at edges where foil mask is weak
5. **COMPARE**: Should match JM reference (silvery raised foil)

### Motion Test
1. Move cursor slowly across the page
2. **EXPECT**: Highlights clearly sweep/move across the foil surface
3. **CHECK**: Different areas brighten as cursor approaches
4. **(Mobile)** Tilt device → lighting should shift

### Constraint Test  
1. **EXPECT**: Sticker centered in viewport ✓ (from #22)
2. **EXPECT**: Dark eye slots remain matte (no foil shimmer) ✓
3. **EXPECT**: Orange overflow-eyes face shape preserved ✓

## Key Insight

**Metallic surfaces reflect their environment**. In typical lighting, silver/chrome appears bright (50-80% luminance), not dark pewter (30-45%). By setting ambient to 75% of an already-bright chrome color (0.82), we ensure the foil reads as silver even in non-specular areas.

This matches the JM reference: bright silvery raised foil with clear multi-layer depth.

## Files Changed
- `public/scripts/dragonFoilShaders.ts` - Shader lighting calculations
- `public/scripts/createDragonFoilStamp.ts` - Default foil parameters

## References
- Issue: #23 (QA FAIL: flat peach, no pointer response)
- Prior: PR #28 (correct structure, but lighting too dark)
- Reference: `jonathanmoore.com` dragon foil (silvery layered)
- Bundle: `main-TbCQnhpL.js` showed peach post-PR#28 → should be silver post-PR#33
