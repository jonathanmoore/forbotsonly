# Grok Bot Character Marks

Printable SVG assets for the forbotsonly merch store. These marks can be used for apparel printing, stickers, avatars, and other merchandise.

## Overview

The Grok Bot character mark system consists of:
- **8 base shapes** × **11 colors** = 88 base marks
- Eye layout variants for the hero mark (orange hexagon)
- Pocket-print optimized version for apparel

All marks feature two dark oblong "slot" eyes positioned on the shape.

## Files

### Base Marks
Format: `grok-bot-{shape}-{color}.svg`

**Shapes:**
- `circle` — Round, soft shape
- `vertical-oval` — Tall oval
- `rounded-square` — Squircle-like square
- `horizontal-pill` — Wide capsule
- `rounded-triangle` — Triangle pointing up with rounded corners
- `hexagon` — Flat-top hexagon with rounded corners ⭐ (hero/default)
- `cloud` — 3-lobe cloud shape
- `teardrop` — Teardrop pointing up

**Colors:** (hex values)
- `white` — `#FFFFFF`
- `brown` — `#8B6F47`
- `red` — `#E63946`
- `orange` — `#FF6B35` ⭐ (hero/default)
- `gold` — `#F4A261`
- `light-green` — `#4CAF50`
- `teal` — `#26A69A`
- `blue` — `#2196F3`
- `purple` — `#9C27B0`
- `hot-pink` — `#E91E63`
- `grey` — `#9E9E9E`

### Eye Layout Variants
Format: `grok-bot-{shape}-{color}-eyes-{layout}.svg`

Currently available for **orange hexagon** only:
- `grok-bot-hexagon-orange-eyes-centered.svg` — Symmetrically centered eyes
- `grok-bot-hexagon-orange-eyes-wider.svg` — Eyes further apart horizontally
- `grok-bot-hexagon-orange-eyes-higher.svg` — Eyes positioned higher on shape

Default eye layout (`grok-bot-hexagon-orange.svg`): Slanted pair, asymmetric toward upper-right — matches the "Chief of Staff" bot UI.

### Pocket-Print (Apparel)
Format: `pocket-grok-bot-{shape}-{color}.svg`

**Hero/Default:** `pocket-grok-bot-hexagon-orange.svg`

Optimized for pocket or small chest prints on apparel:
- **Intended print size:** ~2 inches (2" × 2")
- **ViewBox:** 192 × 192 (96 DPI × 2 inches)
- **Print recommendation:** Works best on dark backgrounds (black, navy, charcoal)
- Vector format scales to any size, but sweet spot is 1.5"–3" for detail visibility

## Hero Mark (Chief of Staff Default)

**Shape:** Hexagon  
**Color:** Orange (`#FF6B35`)  
**Eyes:** Default layout (slanted, upper-right asymmetry)  
**Files:**
- `grok-bot-hexagon-orange.svg` (standard, 100×100 viewBox)
- `pocket-grok-bot-hexagon-orange.svg` (pocket-print, 192×192 viewBox)

This is the canonical "Grok Bot" mark used for the Chief of Staff persona.

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
1. Create all 88 base shape × color combinations
2. Generate eye layout variants for the orange hexagon
3. Generate the pocket-print hero mark
4. Output all files to `assets/marks/`

## Technical Details

### SVG Structure
Each mark SVG contains:
- `<g id="mark">` — Main container
  - `<g id="shape">` — Shape fill and stroke
  - `<g id="eyes">` — Two ellipse elements (the "slot" eyes)

### Eyes
- **Shape:** Ellipses (rx=4, ry=7) rotated to create oblong "slots"
- **Color:** `#1A1A1A` (dark) on all backgrounds except white
- **Color on white:** `#2C2C2C` (slightly lighter for legibility)
- **Layouts:** Controlled by position (x, y) and rotation angle

### Print Specifications
- **Standard marks:** 100×100 viewBox, scales to any size
- **Pocket-print marks:** 192×192 viewBox, optimized for ~2" physical print
- **Format:** SVG (vector, resolution-independent)
- **Color mode:** Flat fills, no gradients (DTG and screen-print friendly)
- **Print methods:** Compatible with DTG (direct-to-garment), screen printing, heat transfer

## Usage Guidelines

### Apparel Printing
- Use pocket-print variants for chest/pocket placement (1.5"–3" recommended)
- Orange marks work best on dark fabrics (black, navy, charcoal, dark grey)
- White/light-green marks work on dark fabrics
- For light fabrics, use darker color marks (blue, purple, brown, red)

### Digital Use
- Use standard marks (100×100) for web, apps, avatars
- SVGs scale infinitely — use CSS/attributes to size as needed
- All marks are transparent-background (no fill on artboard)

### Color Combinations
Mix and match shapes and colors to create unique bot personalities:
- **Friendly:** circle, cloud, teardrop in orange, gold, light-green
- **Professional:** hexagon, rounded-square in blue, teal, grey
- **Playful:** rounded-triangle, horizontal-pill in hot-pink, purple, orange

## License & Usage

These marks are for use in the forbotsonly merch store and related Grok Bot branding.

---

Generated with ❤️ by `scripts/generate-marks.ts`
