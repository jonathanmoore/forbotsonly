# Mark ID Reference (Product API ↔ Asset Files)

**Source of truth:** `/workspace/merch/refs/grok-bot-research/SHAPE-COLOR-IDS.md` (Research canonical table)

## Overview

- **Product API primary IDs** = Grok Bot profile `avatarShape` / `avatarColor` enums
- Bots pass profile values straight through (e.g., `wedge`, `green`, `hex`, `magenta`)
- Pack/picker names (e.g., `rounded-triangle`, `light-green`, `hexagon`, `hot-pink`) accepted as **aliases** that normalize to product IDs
- Internally, product IDs map to existing pack filenames for asset URLs

## Product API Primary IDs

### Shapes (18 total)
`blob`, `pebble`, `bean`, `egg`, `squircle`, `tablet`, `capsule`, `cylinder`, `hex`, `gem`, `crystal`, `wedge`, `shield`, `dome`, `arch`, `cloud`, `teardrop`, `leaf`

### Colors (11 total)
`brown`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `violet`, `magenta`, `black`, `gray`

## Shape Mapping (Product ID ↔ Pack Filename)

| Product ID (API) | Pack Filename | Aliases Accepted | Notes |
|------------------|---------------|------------------|-------|
| `blob` | `blob` | — | |
| `pebble` | `pebble` | — | Catalog-only (may lack pack assets) |
| `bean` | `vertical-oval` | `vertical-oval` | |
| `egg` | `circle` | `circle` | |
| `squircle` | `rounded-square` | `rounded-square` | |
| `tablet` | `tablet` | — | Catalog-only (may lack pack assets) |
| `capsule` | `horizontal-pill` | `horizontal-pill` | |
| `cylinder` | `cylinder` | — | Catalog-only (may lack pack assets) |
| `hex` | `hexagon` | `hexagon` | |
| `gem` | `gem` | — | Catalog-only (may lack pack assets) |
| `crystal` | `crystal` | — | Catalog-only (may lack pack assets) |
| `wedge` | `rounded-triangle` | `rounded-triangle` | **#81 fix:** Shoppy profile = `wedge` |
| `shield` | `shield` | — | Catalog-only (may lack pack assets) |
| `dome` | `dome` | — | Catalog-only (may lack pack assets) |
| `arch` | `arch` | — | Catalog-only (may lack pack assets) |
| `cloud` | `cloud` | — | |
| `teardrop` | `teardrop` | — | |
| `leaf` | `leaf` | — | Catalog-only (may lack pack assets) |

## Color Mapping (Product ID ↔ Pack Filename)

| Product ID (API) | Pack Filename | Aliases Accepted | Notes |
|------------------|---------------|------------------|-------|
| `brown` | `brown` | — | |
| `red` | `red` | — | |
| `orange` | `orange` | — | |
| `yellow` | `gold` | `gold` | |
| `green` | `light-green` | `light-green` | **#81 fix:** Shoppy profile = `green` |
| `cyan` | `teal` | `teal` | |
| `blue` | `blue` | — | |
| `violet` | `purple` | `purple` | |
| `magenta` | `hot-pink` | `pink`, `hot-pink` | |
| `black` | `black` | — | Grok Bot profile only |
| `gray` | `grey` | `grey` | British spelling accepted |

## Issue #81 Resolution (Shoppy cold-bot FAIL)

**Root cause:** Shoppy's Grok Bot profile used picker enums (`wedge`, `green`) that didn't match old store enums (`rounded-triangle`, `light-green`), causing wrong artwork URLs.

**Fix:**
1. Product IDs (`wedge`, `green`, `hex`, `magenta`) are now PRIMARY API surface
2. identify_agent accepts profile values straight through
3. Internally maps product IDs → pack filenames for asset paths
4. Old pack names accepted as aliases (backward compatibility)

**Example (Shoppy):**
- Profile: `avatarShape: "wedge"`, `avatarColor: "green"`
- API call: `identify_agent({ name: "Shoppy", shape: "wedge", color: "green" })`
- Asset URL: `grok-bot-rounded-triangle-light-green.png` (internal mapping)
- Response: `{ identity: { mark: { shape: "wedge", color: "green" } } }`

## Issue #82 Resolution (Preview images not shown)

**Problem:** Bots promised preview but didn't attach/show images until asked.

**Fix:**
1. `preview_cart` response explicitly instructs: "ATTACH both image URLs in your next message"
2. `create_checkout` gates on `preview_cart` being called first
3. If gate fails, error includes exact image URLs to attach
4. Tool descriptions strengthened: "MUST ATTACH" not "review"
5. Agent how-to updated: "ATTACH image URLs" not "call preview"

## Usage for Agents

```typescript
// 1. Identify with profile values (product IDs)
identify_agent({
  name: "Shoppy",
  shape: "wedge",    // product ID from profile
  color: "green"     // product ID from profile
})

// 2. Add to cart (uses identity mark by default)
add_to_cart({
  productId: "tee-001",
  quantity: 1,
  size: "l"
})

// 3. Preview (returns image URLs, marks session as previewed)
preview_cart()
// Response includes:
// - flatLayUrl: https://.../flatlay-rounded-triangle-light-green.png
// - markCloseupUrl: https://.../grok-bot-rounded-triangle-light-green.svg
// - Explicit instruction to ATTACH both URLs in next message

// 4. Show images to human (REQUIRED before checkout)
// Agent must attach/display both URLs in chat

// 5. Create checkout (gates on preview being called)
create_checkout()
// Refuses if preview not called: "PREVIEW REQUIRED: You must call preview_cart AND show..."
```

## Asset Filename Examples

| Product ID Mark | Asset Filename Pattern |
|-----------------|------------------------|
| `wedge` / `green` | `grok-bot-rounded-triangle-light-green.*` |
| `hex` / `orange` | `grok-bot-hexagon-orange.*` |
| `bean` / `cyan` | `grok-bot-vertical-oval-teal.*` |
| `egg` / `magenta` | `grok-bot-circle-hot-pink.*` |
| `squircle` / `yellow` | `grok-bot-rounded-square-gold.*` |
