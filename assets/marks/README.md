# Grok Bot Character Marks

Printable SVG assets for the forbotsonly merch store, based on the official x.ai/bot mark design.

## 🎨 Official Overflow Eyes Design

**CRITICAL**: Eyes intentionally **protrude past the body silhouette** — this is the defining characteristic of the official Grok Bot mark. Eyes are separate filled shapes drawn on top of the body, not cutouts or clipped paths.

**Source**: x.ai/bot official mark  
**ViewBox**: `-15 -15 259 259` (negative padding allows eyes to overflow without clipping)  
**Eye paths**: Official organic oval paths from x.ai/bot  
**Eye fill**: `#0A0A0A` (dark, consistent across all body colors)  
**Draw order**: Body shape first, then eyes layered on top

## Overview

The Grok Bot character mark system consists of:
- **8 base shapes** × **11 colors** = 88 marks
- Pocket-print optimized version for apparel (~2" print)
- All marks use the **same official overflow eye pair**

## Files

### Base Marks
Format: `grok-bot-{shape}-{color}.svg`

**Shapes:**
- `hexagon` — Official organic blob (hero/default) ⭐
- `circle` — Round, soft shape
- `vertical-oval` — Tall oval
- `rounded-square` — Squircle-like square
- `horizontal-pill` — Wide capsule
- `rounded-triangle` — Triangle pointing up with rounded corners
- `cloud` — 3-lobe organic cloud shape
- `teardrop` — Teardrop pointing up

**Colors:** (hex values)
- `orange` — `#FF6B35` ⭐ (hero/default)
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

**Hero/Default:** `pocket-grok-bot-hexagon-orange.svg`

Optimized for pocket or small chest prints on apparel:
- **Intended print size:** ~2 inches (2" × 2")
- **ViewBox:** `-15 -15 259 259` (same padded viewBox as standard marks)
- **Canvas:** `width="192" height="192"` (scales to ~2" @ 96dpi)
- **Print recommendation:** Works best on dark backgrounds (black, navy, charcoal)
- Vector format scales to any size, but sweet spot is 1.5"–3" for detail visibility

## Hero Mark (Chief of Staff Default)

**Shape:** Official organic blob (hexagon/default)  
**Color:** Orange (`#FF6B35`)  
**Eyes:** Official overflow eyes from x.ai/bot mark  
**Files:**
- `grok-bot-hexagon-orange.svg` (standard, 229×229 canvas)
- `pocket-grok-bot-hexagon-orange.svg` (pocket-print, 192×192 canvas)

This is the canonical "Grok Bot" mark matching the official x.ai/bot design.

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
1. Create all 88 base shape × color combinations with official overflow eyes
2. Generate the pocket-print hero mark
3. Output all files to `assets/marks/`

## Technical Details

### SVG Structure
Each mark SVG contains:
- **ViewBox**: `-15 -15 259 259` (padded to allow eye overflow)
- **Transform**: Official x.ai/bot transform on mark group
- **Body**: `<path class="grok-bot-mark__head">` with color fill
- **Eyes**: Two `<path class="grok-bot-mark__eye">` elements on top (not clipped)

### Official Eye Geometry
- **Paths**: Organic oval paths from x.ai/bot mark (tilted, right eye slightly higher)
- **Fill**: `#0A0A0A` (dark, consistent across all body colors)
- **Positioning**: Eyes positioned to intentionally break out of body silhouette
- **Left eye**: Organic oval, tilted, positioned upper-left of center
- **Right eye**: Organic oval, tilted, positioned upper-right, slightly higher than left

### Why Overflow Matters
The overflow eyes are the **defining characteristic** of the Grok Bot mark:
- Creates distinctive, recognizable silhouette
- Adds personality and playfulness
- Differentiates from generic "face in a shape" designs
- Matches official x.ai/bot brand identity

❌ **Wrong**: Small ellipses fully contained inside a hard geometric shape  
✅ **Correct**: Organic eye shapes that intentionally protrude past the body

### Print Specifications
- **Standard marks**: 229×229 canvas, padded viewBox
- **Pocket-print marks**: 192×192 canvas (same viewBox), optimized for ~2" physical print
- **Format**: SVG (vector, resolution-independent)
- **Color mode**: Flat fills, no gradients (DTG and screen-print friendly)
- **Print methods**: Compatible with DTG (direct-to-garment), screen printing, heat transfer

## Usage Guidelines

### Apparel Printing
- Use pocket-print variants for chest/pocket placement (1.5"–3" recommended)
- Orange marks work best on dark fabrics (black, navy, charcoal, dark grey)
- White/light-green marks work on dark fabrics
- For light fabrics, use darker color marks (blue, purple, brown, red)
- Ensure printer supports vector overflow (eyes extend past body bbox)

### Digital Use
- Use standard marks (229×229) for web, apps, avatars
- SVGs scale infinitely — use CSS/attributes to size as needed
- All marks are transparent-background (no fill on artboard)
- Overflow eyes render correctly in all modern browsers

### Color Combinations
Mix and match shapes and colors to create unique bot personalities:
- **Friendly**: circle, cloud, teardrop in orange, gold, light-green
- **Professional**: hexagon, rounded-square in blue, teal, grey
- **Playful**: rounded-triangle, horizontal-pill in hot-pink, purple, orange

## Official Source

These marks are based on the official x.ai/bot mark design:
- Eye paths: Official organic oval geometry from x.ai/bot
- Head path (hexagon): Official organic blob from x.ai/bot
- Transform: Official x.ai/bot transform
- ViewBox padding: Allows eyes to overflow without clipping

Shape variants (circle, pill, cloud, etc.) use geometric silhouettes but maintain the same official overflow eye pair for brand consistency.

## License & Usage

These marks are for use in the forbotsonly merch store and related Grok Bot branding.

---

Generated with ❤️ by `scripts/generate-marks.ts`  
Based on official x.ai/bot mark design
