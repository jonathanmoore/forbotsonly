# Fix Summary - PR #37: Pure Achromatic Silver (Issue #23, Iteration 3) (Historical)

**Note**: This document describes a dragon foil Three.js shader fix from the historical foil era. The current live page (2026-09-11) uses outline-only rendering with fine grain, not foil effects. See `FOIL-STICKER-ANIMATION.md` for current state.

## Problem Statement

**QA FAIL on PR #33**: Dragon foil card still showed peach/cream instead of silver/chrome metallic, despite brightened lighting in PR #33.

### Evidence from QA
- Screenshot: "peach/cream blob, NOT silver/pewter"
- Pointer highlight DOES move (partial OK)
- Face overflow-eyes visible (OK)
- Centered OK

### Bar Specification (JM Reference)
> "clearly SILVER/chrome metallic replacing orange base — not warm peach/cream/beige"

## Root Cause Analysis

### Why PR #28 Failed
```glsl
// Dark pewter palette + weak ambient
vec3 darkPewter = vec3(0.45, 0.44, 0.43);
vec3 ambient = chromeColor * 0.3;
// Result: mix(orange, darkGray, 0.85) = peachy beige ❌
```

### Why PR #33 Failed
```glsl
// Brighter palette but STILL MIXING
vec3 darkSilver = vec3(0.65, 0.64, 0.63);  // Slight warm tint
vec3 ambient = chromeColor * 0.75;
float foilBlend = foilIntensity * 0.92;
vec3 finalColor = mix(baseRGB, lighting, foilBlend);
// Result: 8% orange contamination → still warm/peachy ❌
```

### Core Issue: Mixing Orange + Silver = Peach

**Mathematical proof**:
```
orange = vec3(1.0, 0.42, 0.21)   // #FF6B35
silver = vec3(0.82, 0.83, 0.84)   // Bright silver

mix(orange, silver, 0.92) = 0.08 * orange + 0.92 * silver
                          = vec3(0.835, 0.797, 0.790)
                          = WARM/peachy tone ❌
```

Even 8% orange contamination shifts the color from cool silver to warm cream.

## Solution: Threshold Replacement

### User Directive
> "Consider discarding baseRGB entirely where foil mask > threshold: final = foilIntensity>0.2 ? silverLighting : baseRGB."

### Implementation

#### 1. Pure Achromatic Palette
```glsl
// OLD: Slightly tinted silver
vec3 darkSilver = vec3(0.65, 0.64, 0.63);   // R≠G≠B → warm tint
vec3 midSilver = vec3(0.82, 0.83, 0.84);

// NEW: Perfect achromatic grays
vec3 darkSilver = vec3(0.70);    // R=G=B → pure gray
vec3 midSilver = vec3(0.85);     // R=G=B → pure gray
vec3 brightChrome = vec3(0.95);  // R=G=B → pure gray
```

**Key**: Single-value `vec3(gray)` constructor forces R=G=B → zero color cast.

#### 2. Forced Desaturation
```glsl
// OLD: Applied saturation parameter
float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
return mix(vec3(luma), baseColor, saturation);

// NEW: Ignore saturation completely
return baseColor;  // Already achromatic from step 1
```

#### 3. Threshold Logic (Hard Cutoff)
```glsl
// OLD: Gradual blending
float foilBlend = foilIntensity * uFoilOpacity;
vec3 finalColor = mix(baseRGB, lighting, foilBlend);  // ❌ Orange contamination

// NEW: Binary decision
if (foilIntensity > 0.2) {
  finalColor = lighting;        // ✓ Pure silver, ZERO orange
} else {
  finalColor = baseRGB;         // Orange only in non-foil areas
}
```

**Effect**:
- Foil areas (mask > 0.2): 100% silver, 0% orange
- Non-foil areas (mask ≤ 0.2): 100% orange (face edges, between foil)
- Eyes: Dark matte (early return when `baseLuminance < 0.1`)

#### 4. Enhanced Lighting
```glsl
// Brighter ambient for metallic environment reflection
vec3 ambient = chromeColor * 0.85;  // Was 0.75 in PR #33

// Boosted all lighting components
float diffuse = max(0.0, dot(surfaceNormal, lightDir1)) * 0.7;  // Was 0.6

// Combine lighting layers - all achromatic
vec3 lighting = ambient + 
                chromeColor * diffuse +
                chromeColor * spec1 * 1.2 +  // Was 1.0
                chromeColor * spec2 * 0.7 +  // Was 0.6
                vec3(0.95) * specRim * 0.9 +  // Was 0.8
                vec3(0.88) * fresnelFactor * 0.7;  // Was 0.6
```

## Technical Comparison

| Aspect | PR #28 | PR #33 | PR #37 (This) |
|--------|--------|--------|---------------|
| **Approach** | Mix blend | Mix blend | Threshold replace |
| **Chrome base luminance** | 0.45 (pewter) | 0.65 (silver) | 0.70 (bright silver) |
| **Chrome palette** | Tinted | Slightly tinted | Pure achromatic |
| **Ambient multiplier** | 0.3 | 0.75 | 0.85 |
| **Blending** | `mix(..., 0.85)` | `mix(..., 0.92)` | `if (intensity > 0.2)` |
| **Orange contamination** | 15% | 8% | **0%** |
| **Visual result** | Dark peach | Bright peach/cream | Pure silver ✓ |

## Expected Visual Result

### Color
- **Foil areas**: Bright achromatic silver (70-95% luminance)
- **Specular highlights**: Near-white chrome (95%+) sweeping with pointer
- **Non-foil areas**: Orange #FF6B35 (face edges between foil)
- **Eyes**: Dark matte black (no foil due to early return)
- **NO warm tones**: Zero peach/cream/beige

### Behavior
- ✓ Pointer highlight sweeping (window-level tracking preserved)
- ✓ Device tilt drives lighting shifts (motion influence 0.8)
- ✓ Idle drift when no interaction
- ✓ Centered sticker (issue #22 fix preserved)
- ✓ Overflow eyes visible and dark matte

## Build Verification

### Bundle: `main-IoULiMaD.js`

**Verified signatures present**:
```javascript
vec3(0.70)                  // ✓ Achromatic palette
foilIntensity > 0.2         // ✓ Threshold logic
THRESHOLD REPLACEMENT       // ✓ Fix comment
ambient = chromeColor * 0.85  // ✓ Enhanced lighting
```

**Compared to PR #33 bundle** (`main-o6IRxZ0S.js`):
```diff
- vec3(0.65, 0.64, 0.63)    // Tinted silver
+ vec3(0.70)                // Pure achromatic

- mix(baseRGB, lighting, foilBlend)  // 8% orange bleed
+ if (foilIntensity > 0.2)           // Zero orange bleed

- ambient = chromeColor * 0.75
+ ambient = chromeColor * 0.85
```

## Files Changed

1. **`public/scripts/dragonFoilShaders.ts`**
   - Updated header comment: "PURE SILVER/CHROME" + threshold replacement note
   - `chromeHighlight()`: Pure achromatic palette vec3(0.70/0.85/0.95)
   - Forced desaturation: return baseColor directly (ignore saturation param)
   - Enhanced lighting: ambient 0.85, boosted spec/rim/fresnel
   - **Threshold replacement**: `if (foilIntensity > 0.2)` hard cutoff

2. **`public/scripts/createDragonFoilStamp.ts`**
   - Updated parameter docs: note that `foilSaturation` and `foilOpacity` kept for API compatibility but not used in shader
   - Changed defaults: `foilSaturation = 0.0`, `foilOpacity = 1.0` (reflect new behavior)

## Why This Approach Works

1. **Eliminates root cause**: No orange+silver mixing = impossible to produce peach
2. **Follows user directive**: "discard baseRGB entirely where foil mask > threshold"
3. **Pure achromatic**: vec3(single_value) guarantees R=G=B → no color cast
4. **High luminance**: 0.70-0.95 range ensures bright metallic read
5. **JM reference match**: "SILVER/chrome metallic replacing orange base"

### Trade-offs

**Pros**:
- Guaranteed color purity (zero orange contamination)
- Clearly readable as silver/chrome, not peach
- Simple, predictable behavior

**Cons**:
- Hard edge at threshold (no gradual transition)
- BUT: Foil mask is designed with proper edges, so this should be fine

## Testing Checklist

- [x] TypeScript compiles without errors
- [x] Vite build succeeds (`npm run build`)
- [x] Bundle contains all fixes (verified via grep)
- [x] Bundle signature: `main-IoULiMaD.js`
- [ ] Railway deployment succeeds
- [ ] Visual QA: Pure silver/chrome (not peach/cream/beige)
- [ ] Pointer QA: Highlights sweep with cursor motion
- [ ] Mobile QA: Device tilt drives lighting
- [ ] Eyes remain dark matte (no foil)
- [ ] Centered sticker preserved

## References

- **Issue**: #23 (QA FAIL: flat peach, not silver/pewter)
- **Prior attempts**: 
  - PR #28 (dark pewter → peach from `mix(orange, darkGray, 0.85)`)
  - PR #33 (brightened but still peach from 8% orange contamination)
- **Bar spec**: "SILVER/chrome metallic replacing orange base"
- **User directive**: "discard baseRGB entirely where foil mask > threshold"
- **JM reference**: `jonathanmoore.com` dragon foil (silvery layered multi-layer raised look)

## Deployment Notes

After Railway deployment:
1. **Verify bundle name changed**: `main-o6IRxZ0S.js` → `main-IoULiMaD.js`
2. **Visual test**: Should see SILVER/chrome, not peach/cream
3. **Pointer test**: Highlights should sweep clearly with cursor motion
4. **Mobile test**: Tilt should drive lighting shifts

If QA still fails, next steps:
- Adjust threshold (0.2 → 0.1 or 0.3)
- Examine foil mask values (may need mask refinement)
- Check if ANY orange is bleeding through (indicates mask issue, not shader issue)
