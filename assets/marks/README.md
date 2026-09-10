# Grok Bot Character Marks

Printable SVG assets for the forbotsonly merch store, based on the **Grok Bot app Character picker** (ground truth).

## 🎨 Shape System (9 Shapes)

**CRITICAL**: `blob` ≠ `hexagon`
- **blob**: Organic brand shape (foil default, Railway hero) — the iconic Grok Bot silhouette
- **hexagon**: TRUE geometric hex (6-sided polygon) — a separate shape option

All 9 shapes from the app Character picker:
1. **blob** — Organic brand default (foil & Railway hero) ⭐
2. **circle** — Round
3. **vertical-oval** — Tall oval
4. **rounded-square** — Squircle
5. **horizontal-pill** — Wide capsule
6. **rounded-triangle** — Triangle pointing up
7. **hexagon** — True geometric hexagon (NOT the blob)
8. **cloud** — 3-lobe organic cloud
9. **teardrop** — Teardrop pointing up

## 👀 Eye Design

**Dark slanted pills/capsules** — consistent style, **per-shape placement**

- **Eye fill**: `#0A0A0A` (dark, all shapes)
- **Style**: Slanted ellipses (pills/capsules)
- **Placement**: Repositioned/scaled/rotated per shape so both eyes read correctly
- **Bug fixed**: No longer pasting blob eye coordinates onto all shapes

Eyes can overflow when appropriate (like the app does), but are properly sized and positioned for each silhouette.

## Overview

The Grok Bot character mark system consists of:
- **9 shapes** × **11 colors** = 99 base marks
- Pocket-print optimized version for apparel (~1.2" Prodigi placement)
- All marks use **dark slanted pill eyes, repositioned per shape**

## Files

### Base Marks
Format: `grok-bot-{shape}-{color}.svg`

**Shapes:**
- `blob` — Organic brand default (foil, Railway hero) ⭐
- `circle` — Round, soft shape
- `vertical-oval` — Tall oval
- `rounded-square` — Squircle-like square
- `horizontal-pill` — Wide capsule
- `rounded-triangle` — Triangle pointing up with rounded corners
- `hexagon` — True geometric hexagon (NOT the blob)
- `cloud` — 3-lobe organic cloud shape
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
Format: `pocket-grok-bot-{shape}-{color}.svg`

**Brand Default:** `pocket-grok-bot-blob-orange.svg`

Optimized for apparel printing:
- **SVG canvas:** `width="192" height="192"` (native asset size)
- **ViewBox:** `-15 -15 259 259` (same padded viewBox as standard marks)
- **Prodigi print placement:** ~1.2 inches (~360px @ 300dpi front placement target)
- **Print recommendation:** Works best on dark backgrounds (black, navy, charcoal)
- Vector format scales to any size; pocket assets can be printed at various sizes (1"–3" range works well)

## Brand Default (Foil, Railway Hero)

**Shape:** Organic blob (NOT hexagon)  
**Color:** Orange (`#FF6B35`)  
**Eyes:** Dark slanted pills, positioned for blob silhouette  
**Files:**
- `grok-bot-blob-orange.svg` (standard, 229×229 canvas)
- `pocket-grok-bot-blob-orange.svg` (pocket-print, 192×192 canvas)

This is the canonical Grok Bot mark for foil branding and Railway hero.

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
1. Create all 99 base shape × color combinations with per-shape eye layouts
2. Generate the pocket-print brand default (orange blob)
3. Output all files to `assets/marks/`

## Technical Details

### SVG Structure
Each mark SVG contains:
- **ViewBox**: `-15 -15 259 259` (padded to allow eye overflow when appropriate)
- **Body**: `<path class="grok-bot-mark__head">` with color fill
- **Eyes**: Two `<ellipse>` elements in `<g class="grok-bot-mark__eyes">` group

### Eye Geometry (Per-Shape)
- **Fill**: `#0A0A0A` (dark, consistent across all body colors)
- **Shape**: Ellipses (rx/ry define pill/capsule proportions)
- **Transform**: Rotation per eye for slanted appearance
- **Positioning**: cx/cy coordinates differ per shape to match silhouette

Each shape has its own eye configuration:
- **Blob**: Larger eyes (rx=8, ry=16), overflow style
- **Circle**: Medium eyes (rx=7, ry=14), positioned at top
- **Horizontal pill**: Smaller eyes (rx=6, ry=12), wide spacing
- And so on... eyes are scaled and positioned to read correctly on each shape

### Why Per-Shape Eye Layouts Matter
Pasting the same blob eye path coordinates onto all shapes doesn't work:
- ❌ **Wrong**: Blob eye coordinates on skinny shapes → eyes fall outside or look wrong
- ✅ **Correct**: Reposition/scale/rotate eyes per shape → both eyes read clearly

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

### Color Combinations
Mix and match shapes and colors to create unique bot personalities:
- **Friendly**: circle, cloud, teardrop in orange, gold, light-green
- **Professional**: blob, rounded-square in blue, teal, grey
- **Playful**: rounded-triangle, horizontal-pill in hot-pink, purple, orange

## Shape Naming (Important)

### In Code & Assets
- `blob` — Organic brand shape (foil default, Railway hero)
- `hexagon` — True geometric hex (separate shape option)

### Product Alignment
Match `identify_agent` enums on the store:
- Prefer **"blob"** or **"official"** for the organic brand shape
- Use **"hexagon"** only for the geometric hex

**Do NOT call the blob "hexagon"** — they are separate shapes.

## Ground Truth

These marks are based on the **Grok Bot app Character picker** screenshots:
- 9 shapes from the production app picker UI
- Dark slanted pill/capsule eyes, repositioned per shape
- Shape silhouettes matching the app's visual design

Eye coordinates are tuned per shape to match the app's appearance, not copy-pasted from blob.

## License & Usage

These marks are for use in the forbotsonly merch store and related Grok Bot branding.

---

Generated with ❤️ by `scripts/generate-marks.ts`  
Based on Grok Bot app Character picker (ground truth)
