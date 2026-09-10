# Grok Bot Character Marks

Printable SVG assets for the forbotsonly merch store, **modeled on GrokBotMark product mechanism** (face layout system).

## 🧬 Product Mechanism: Face Layout System

Eyes are **recomputed** from shape's `face` params (position/scale/leftDX/rightDX), **not** pasted from blob paths.

### How Eyes Are Computed

```typescript
// 1. Face params define eye layout per shape
interface FaceParams {
  centerX, centerY    // Base eye position
  eyeSpacing          // Pair spacing
  baseRX, baseRY      // Base dimensions
  rotation            // Slant angle
  leftDX, leftDY      // Left eye offset
  rightDX, rightDY    // Right eye offset
}

// 2. Recipe weight scales eyes per shape
const recipeWeight = EYE_SCALE_WEIGHTS[productID]; // 0.84–1.0

// 3. Compute final eye dimensions
const rx = baseRX * recipeWeight;
const ry = baseRY * recipeWeight;

// 4. Compute eye positions with offsets
const cx = centerX ± (eyeSpacing/2) + dx;
const cy = centerY + dy;
```

### Recipe Weights (GROK_BOT_RECIPE_*)

Per-shape eye scale factors:
- **blob**: `0.92`
- **egg** (circle): `0.96`
- **bean** (vertical-oval): `0.96`
- **squircle** (rounded-square): `0.84` ⬅️ smallest
- **capsule** (horizontal-pill): `1.0` ⬅️ largest
- **wedge** (rounded-triangle): `0.94`
- **hex** (hexagon): `0.94`
- **cloud**: `1.0`
- **teardrop**: `1.0`

## 📐 Shape ID Mapping

**App Picker Names ↔ Product Catalog IDs**

| App Picker (9 shapes)   | Product ID | Recipe Weight |
|------------------------|------------|---------------|
| `blob` ⭐              | `blob`     | 0.92          |
| `circle`               | `egg`      | 0.96          |
| `vertical-oval`        | `bean`     | 0.96          |
| `rounded-square`       | `squircle` | 0.84          |
| `horizontal-pill`      | `capsule`  | 1.0           |
| `rounded-triangle`     | `wedge`    | 0.94          |
| `hexagon` (geometric)  | `hex`      | 0.94          |
| `cloud`                | `cloud`    | 1.0           |
| `teardrop`             | `teardrop` | 1.0           |

**Note**: `blob` ≠ `hexagon` — blob is organic brand shape (foil/Railway hero), hexagon is a separate geometric hex.

### Product Catalog (~18 IDs)

Full catalog: blob, pebble, bean, egg, squircle, tablet, capsule, cylinder, hex, gem, crystal, wedge, shield, dome, arch, cloud, teardrop, leaf

**This pack includes**: 9 app picker shapes (subset of catalog)  
**Optional extras**: pebble, gem, crystal, shield, dome, arch, leaf (not required for this PR)

## 👀 Eye Design

**Dark slanted pills** — computed from face layout, **never pasted from blob**

- **Eye fill**: `#0A0A0A` (dark, all shapes)
- **Style**: Slanted ellipses (computed from face params)
- **Computation**: `baseRX/baseRY` × `recipeWeight` + position offsets
- **Result**: Eyes sized and positioned correctly per silhouette

### What Changed (Chief of Staff Lock)

**OLD (wrong)**: Hand-wavy ellipses, hardcoded positions  
**NEW (correct)**: Face layout system, recipe weights, computed from params

**Do NOT**:
- ❌ Paste blob overflow-eye path `d`s onto other shapes
- ❌ Hardcode eye positions without face params
- ❌ Ignore recipe weight scaling

**DO**:
- ✅ Compute eyes from face params (centerX/Y, spacing, offsets)
- ✅ Apply recipe weight to base dimensions
- ✅ Tune params against app picker screenshots

## Overview

The Grok Bot character mark system consists of:
- **9 app picker shapes** × **11 colors** = 99 base marks
- Pocket-print optimized version for apparel (~1.2" Prodigi placement)
- All marks use **face layout computation** (product mechanism)

## Files

### Base Marks
Format: `grok-bot-{picker-shape}-{color}.svg`

**Shapes** (App Picker Names):
- `blob` — Organic brand default (foil, Railway hero) ⭐
- `circle` — Round (product ID: egg)
- `vertical-oval` — Tall oval (product ID: bean)
- `rounded-square` — Squircle (product ID: squircle)
- `horizontal-pill` — Wide capsule (product ID: capsule)
- `rounded-triangle` — Triangle pointing up (product ID: wedge)
- `hexagon` — True geometric hexagon (product ID: hex)
- `cloud` — 3-lobe organic cloud
- `teardrop` — Teardrop pointing up

**Colors:** (hex values)
- `orange` — `#FF6B35` ⭐ (brand color)
- `white` — `#FFFFFF`
- `brown` — `#8B6F47`
- `red` — `#E63946`
- `gold` — `#F4A261`
- `light-green` — `#4CAF50`
- `teal` — `#26A69A`
- `blue` — `#2196F3`
- `purple` — `#9C27B0`
- `hot-pink` — `#E91E63`
- `grey` — `#9E9E9E`

### Pocket-Print (Apparel)
Format: `pocket-grok-bot-{picker-shape}-{color}.svg`

**Brand Default:** `pocket-grok-bot-blob-orange.svg`

Optimized for apparel printing:
- **SVG canvas:** `width="192" height="192"` (native asset size)
- **ViewBox:** `-15 -15 259 259` (padded for blob overflow)
- **Prodigi print placement:** ~1.2 inches (~360px @ 300dpi front placement target)
- **Print recommendation:** Works best on dark backgrounds (black, navy, charcoal)
- Vector format scales to any size; pocket assets can be printed at various sizes (1"–3" range works well)

## Brand Default (Foil, Railway Hero)

**Shape:** Organic blob (NOT hexagon)  
**Product ID:** `blob`  
**Color:** Orange (`#FF6B35`)  
**Eyes:** Computed from blob face params (recipe weight 0.92)  
**Files:**
- `grok-bot-blob-orange.svg` (standard, 229×229 canvas)
- `pocket-grok-bot-blob-orange.svg` (pocket-print, 192×192 canvas)

This is the canonical Grok Bot mark for foil branding and Railway hero. **Brand overflow eyes blob only** — lives on storefront PR #10.

## Regenerating Marks

To regenerate all SVG files:

```bash
bun run marks:generate
```

Or run the generator script directly:

```bash
bun scripts/generate-marks.ts
```

The generator will:
1. Compute eyes from face params + recipe weights for each shape
2. Generate all 99 app picker shape × color combinations
3. Generate the pocket-print brand default (orange blob)
4. Output all files to `assets/marks/`

## Technical Details

### SVG Structure
Each mark SVG contains:
- **ViewBox**: `-15 -15 259 259` (padded for blob overflow)
- **Metadata**: `data-product-id` and `data-picker-shape` attributes
- **Body**: `<path class="grok-bot-mark__head">` with color fill
- **Eyes**: Two `<ellipse>` elements in `<g class="grok-bot-mark__eyes">` group

### Eye Computation (Face Layout)

Eyes are **computed**, not hardcoded:

```xml
<!-- Example: squircle (recipe weight 0.84) -->
<ellipse cx="86.50" cy="75.00" rx="6.97" ry="13.02" fill="#0A0A0A" 
         transform="rotate(-20 86.50 75.00)"/>
```

Where:
- `rx = baseRX (8.3) × recipeWeight (0.84) = 6.97`
- `ry = baseRY (15.5) × recipeWeight (0.84) = 13.02`
- `cx = centerX (108) - spacing/2 (17.5) + leftDX (-4) = 86.5`
- `cy = centerY (73) + leftDY (2) = 75`

### Face Params (Per Shape)

Each shape has tuned face params:

```typescript
// Example: blob (brand default)
blob: {
  centerX: 112,      // Base eye position
  centerY: 72,
  eyeSpacing: 35,    // Distance between eyes
  baseRX: 8.5,       // Base dimensions (before scaling)
  baseRY: 17,
  rotation: -25,     // Slant angle
  leftDX: -5,        // Left eye offset
  leftDY: 3,
  rightDX: 6,        // Right eye offset
  rightDY: -4,
}
```

Tuned from app picker screenshots.

### Print Specifications
- **Standard marks**: 229×229 canvas, padded viewBox
- **Pocket-print marks**: 192×192 canvas (same viewBox), native asset size
- **Prodigi front placement**: ~1.2" (~360px @ 300dpi) — pocket assets scale to this target
- **Format**: SVG (vector, resolution-independent)
- **Color mode**: Flat fills, no gradients (DTG and screen-print friendly)
- **Print methods**: Compatible with DTG (direct-to-garment), screen printing, heat transfer

## Usage Guidelines

### Apparel Printing
- Use pocket-print variants for chest/pocket placement
- **Prodigi placement**: Front placement targets ~1.2" (~360px @ 300dpi)
- Orange marks work best on dark fabrics (black, navy, charcoal, dark grey)
- White/light-green marks work on dark fabrics
- For light fabrics, use darker color marks (blue, purple, brown, red)
- Vector assets scale to any print size; 1"–3" range works well for detail visibility

### Digital Use
- Use standard marks (229×229) for web, apps, avatars
- SVGs scale infinitely — use CSS/attributes to size as needed
- All marks are transparent-background (no fill on artboard)
- Product ID and picker shape available as data attributes

### Color Combinations
Mix and match shapes and colors to create unique bot personalities:
- **Friendly**: circle, cloud, teardrop in orange, gold, light-green
- **Professional**: blob, rounded-square in blue, teal, grey
- **Playful**: rounded-triangle, horizontal-pill in hot-pink, purple, orange

## Shape Naming & Alignment

### In Code & Assets
- Use **app picker names** for filenames: `grok-bot-blob-orange.svg`
- Use **product IDs** in metadata: `data-product-id="blob"`

### Product Alignment
Match `identify_agent` enums on the store:
- Prefer **"blob"** or **"official"** for the organic brand shape
- Use product IDs for backend/catalog references
- Map picker names ↔ product IDs clearly

**Do NOT call the blob "hexagon"** — they are separate shapes.

## Ground Truth & Research

### Sources
- **Product mechanism**: GrokBotMark face layout system
- **App picker screenshots**: `/workspace/merch/refs/grok-bot-research/app-picker-shapes/`
- **Research docs**: `MULTI-SHAPE.md`, `EXTRACTS.md` (when available)
- **JS chunks**: `1_bvoktjb3d2f.js`, `0ow9g96xjl_hd.js` (product code)

### Mechanism
- Discrete `SHAPES[id].path` silhouette swap (no flubber/CSS clip morph)
- Eyes: **recompute** left/right path `d`s from shape's `face` params
- Recipe weights: `GROK_BOT_RECIPE_FACE_TUNE` + per-shape eye scale
- Never paste blob overflow-eye path coordinates onto other shapes

## License & Usage

These marks are for use in the forbotsonly merch store and related Grok Bot branding.

---

Generated with ❤️ by `scripts/generate-marks.ts`  
Based on GrokBotMark product mechanism (face layout system)
