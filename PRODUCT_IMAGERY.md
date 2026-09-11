# Product Imagery Requirements

## Two Types of Imagery

### 1. Store/Human Product Photos (Flat Lay)
See `/workspace/mark-ref/jonathan-flatlay-reference.png` for composition/pose reference.

**Purpose**: Store listings, cart display, human-facing product pages

**Specifications:**
- **Pose**: Front-facing flat lay
- **Style**: Studio photography
- **Sleeves**: Out (not folded)
- **Background**: White or light grey
- **NOT**: Folded tee, lifestyle shot, or worn/modeled
- **Base**: Black tee
- **Mark**: Orange hexagon Grok Bot mark on left chest
- **Placement**: Left chest (wearer's left = viewer's right when facing camera)

### 2. Prodigi Print-Area Artwork (Front Canvas Bake)
See `/workspace/preview-prodigi-black-leftchest.png` for placement reference.

**Purpose**: Prodigi API `assets[].url` for DTG printing

**Specifications for GLOBAL-TEE-BC-3001 (Black Tee):**
- **printArea**: `front` (required - no `pocket` or `leftChest` in Prodigi API)
- **Source Mark**: `assets/marks/pocket-grok-bot-{shape}-{color}.svg` (from PR #9)
  - Asset-native: 192×192px (~2" @ 96dpi) - preserve source resolution
- **Print Size**: **~1.2 inches** (40% smaller than 2" default)
- **Rasterized for 300dpi DTG**: ~360×360px (1.2" × 300dpi)
- **Canvas**: Transparent PNG matching variant `printAreaSizes`
  - Common sizes: 2480×3507px or 4677×5881px (check variant specs)
- **Placement on Front Canvas**:
  - Wearer's left chest = **right half** of front-facing artwork
  - ~2.5–4 inches below HPS (high point shoulder)
  - Clear of centerline
  - See preview image for exact positioning

**Bake Process:**
1. Fetch variant `printAreaSizes` for `front` from Prodigi API
2. Create transparent canvas at that size (e.g., 2480×3507px)
3. Rasterize `pocket-grok-bot-{shape}-{color}.svg` to **360×360px** (1.2" @ 300dpi)
4. Place on right half of canvas (left chest positioning)
5. Export as PNG
6. Upload to CDN or use data URL
7. Pass URL to Prodigi `assets[].url` for `printArea: "front"`

## Reference Analysis

### Store Flat Lay Reference
The first reference shows:
- White tee on dark/black background
- Front-facing flat lay with sleeves extended horizontally
- "LOGO" text and Nike swoosh on left chest area
- Clean, professional studio lighting

**Our Implementation (inverted):**
- Black tee on white/light background
- Same flat lay pose (sleeves out)
- Orange hex Grok Bot mark on left chest

### Prodigi Placement Reference
The preview image (`preview-prodigi-black-leftchest.png`) shows:
- Black tee worn/modeled
- Orange hexagon mark on left chest (wearer's left, viewer's right)
- Correct print placement for Prodigi `front` printArea
- **Use this placement for Prodigi artwork bake**
- **Do NOT use worn/lifestyle style for store photos**

## Current Status

**Store Imagery**: TODO - Commission flat lay photography matching first reference specs

**Prodigi Artwork**: 
- Placeholder URL in code: `https://example.com/artwork.png`
- Source mark available: `assets/marks/pocket-grok-bot-hexagon-orange.svg` (PR #9)
- TODO: Create baked front canvas following Prodigi specs above
- Update `src/server.ts` webhook handler with real artwork URL

## Implementation Notes

### In Product Listings
```typescript
{
  id: 'tee-001',
  name: 'forbotsonly Tee',
  // Store display - flat lay
  imageUrl: '/images/products/forbotsonly-tee-flatlay.jpg',
  // Prodigi print artwork - front canvas bake
  prodigiArtworkUrl: 'https://cdn.example.com/prodigi/front-leftchest-orange-hex.png',
}
```

### In Prodigi Order
```typescript
items: [{
  sku: 'GLOBAL-TEE-BC-3001',
  assets: [{
    printArea: 'front', // Required - no pocket/leftChest API area
    url: 'https://cdn.example.com/prodigi/front-leftchest-orange-hex.png',
  }],
}]
```

## Size Reference

**Mark Dimensions:**
- Source SVG: 192×192px (~2" @ 96dpi) - asset-native resolution
- **Print size: ~1.2 inches** (40% smaller than source)
- Rasterized for print: **360×360px** (1.2" @ 300dpi)
- Left chest: subtle, small mark (~1.2" visible)

**Front Canvas Sizes** (check Prodigi variant for exact sizes):
- Standard: 2480×3507px
- Large format: 4677×5881px

