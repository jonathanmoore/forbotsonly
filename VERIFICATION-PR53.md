# PR #53 Verification: Print Mark Eyes Fix

## PRIORITY FAIL Resolution

**Issue**: horizontal-pill/gold eyes from Blind Shopper preview
- ❌ Eyes overflowed silhouette boundary
- ❌ Eyes were solid black ink (#0A0A0A) instead of transparent knockouts

## Technical Fix

### Before (FAIL)
```svg
<path class="grok-bot-mark__head" d="M 79.2705,74.2705..." fill="#F4A261"/>
<g class="grok-bot-mark__eyes">
  <ellipse cx="70.00" cy="85.00" rx="6.00" ry="12.00" fill="#0A0A0A"/>
  <ellipse cx="120.00" cy="80.00" rx="6.00" ry="12.00" fill="#0A0A0A"/>
</g>
```

**Problems**:
1. Left eye at x=70 is OUTSIDE capsule boundary (starts at x≈79)
2. Separate black ellipse elements print as black ink on top of color

### After (FIXED)
```svg
<path class="grok-bot-mark__compound" fill="#F4A261" fill-rule="evenodd" 
      d="M 79.2705,74.2705 L 149.2705,74.2705 A 40,40 0 0,1...
         M 91.60,79.54 A 5.50,11.00 -18 0,1 100.23,88.30...
         M 129.60,79.54 A 5.50,11.00 -18 0,1 138.23,88.30..."/>
```

**Fixes**:
1. Left eye now starts at x≈91 (INSIDE capsule boundary)
2. Compound path with evenodd → eyes are transparent cutouts
3. Black tee fabric shows through eye holes (not printed ink)

## Verification Matrix

### Shape: horizontal-pill (REPORTED FAIL)
- ✅ Capsule boundary: x=79.27 to x=149.27
- ✅ Left eye: starts x≈91.60 (11.33px safety margin)
- ✅ Right eye: starts x≈129.60 (inside boundary)
- ✅ No #0A0A0A fills (compound path only)

### Shape: hexagon
- ✅ Hex boundary: x=24.27 to x=204.27
- ✅ Left eye: x≈90 (fully inside)
- ✅ Right eye: x≈128 (fully inside)
- ✅ No #0A0A0A fills (compound path only)

### Shape: blob
- ✅ Eyes repositioned (NO overflow for print marks)
- ✅ Overflow reserved for foil sticker only (not in this PR scope)
- ✅ No #0A0A0A fills (compound path only)

### All Other Shapes (circle, vertical-oval, rounded-square, rounded-triangle, cloud, teardrop)
- ✅ Eyes repositioned with safety margins
- ✅ Slanted oval eye language preserved
- ✅ All use compound path knockouts
- ✅ Recipe weights maintained: blob:.92, egg:.96, squircle:.84, capsule:1, wedge:.94, hex:.94, cloud:1, teardrop:1

## Regenerated Assets

### Mark SVGs (100 files)
- 99 standard marks (9 shapes × 11 colors)
- 1 pocket-print variant (blob/orange)
- Locations: `assets/marks/` + `public/images/marks/`

### Flatlay Previews (99 files)
- Photo-quality BC-3001 composites
- 9 shapes × 11 colors (now includes blob)
- Location: `public/images/previews/`
- Shows knockout eyes on actual black tee fabric

## Script Changes

### scripts/generate-marks.ts
- ✅ Eyes converted to path d strings (not ellipse elements)
- ✅ Compound path generation with fill-rule="evenodd"
- ✅ Face layouts adjusted for containment
- ✅ Node.js compatible (was Bun-only)

### scripts/generate-flatlay-composites.mjs
- ✅ Added blob shape to MARK_SHAPES array

## Success Criteria Met

1. ✅ Eyes are knockout transparent cutouts (evenodd compound paths)
2. ✅ Eyes fully contained in ALL shapes with safety margins
3. ✅ horizontal-pill/gold verified (reported FAIL case)
4. ✅ hexagon/orange verified
5. ✅ No #0A0A0A fills in any SVG
6. ✅ Full shape×color grid regenerated (100 SVGs + 99 PNGs)
7. ✅ PR is MERGEABLE (not draft)

## Out of Scope (Intentionally Not Touched)

- Foil/dragon sticker work (#23 — paused)
- Identity/soft-identity work (#50)

## Ready for CoS Squash-Merge

This PR resolves the priority mark-asset FAIL and can be squash-merged to main.
