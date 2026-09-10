# Product Imagery Requirements

## Reference Image
See `/workspace/mark-ref/jonathan-flatlay-reference.png` for composition/pose reference.

## Specifications for forbotsonly Tee

### Composition (from reference)
- **Pose**: Front-facing flat lay
- **Style**: Studio photography
- **Sleeves**: Out (not folded)
- **Background**: Clean, solid color
- **NOT**: Folded tee, lifestyle shot, or worn/modeled

### Our Product Specifics
- **Base**: Black tee (reference shows white - invert)
- **Background**: White or light grey (to contrast with black tee)
- **Mark**: Orange hexagon Grok Bot mark
- **Placement**: Left chest (wearer's left = viewer's right when facing camera)
- **Mark size**: ~3-4 inches, standard left-chest print area

### Reference Analysis
The attached image shows:
- White tee on dark/black background
- Front-facing flat lay with sleeves extended horizontally
- "LOGO" text and Nike swoosh on left chest area
- Clean, professional studio lighting
- No wrinkles or folds
- Centered composition

### Our Implementation
**Invert the reference style:**
- Black tee on white/light background
- Same flat lay pose (sleeves out)
- Orange hex Grok Bot mark where "LOGO" + swoosh appear
- Professional studio lighting
- Clean, wrinkle-free presentation

## Current Status

**Stub/Placeholder**: The E2E implementation currently uses the Grok Bot mark SVG directly. A proper product photo matching this specification should be added when available.

**TODO**: Commission or generate product photography following this flat lay specification:
1. Photograph black GLOBAL-TEE-BC-3001 in flat lay pose
2. Orange hex Grok Bot mark printed on left chest
3. Studio lighting on white/light grey background
4. Match reference composition (sleeves out, centered)

## Product Image Usage

When product images are added:
- Update `public/images/` with high-res flat lay
- Use in product listings (`list_products` response)
- Display in cart/checkout flows
- Maintain aspect ratio for responsive display
