# Morph Bot Element (Trimmed for forbotsonly)

Minimal SVG animation web component for decorative morphing bot sticker.

This is a trimmed vendor copy containing only what's needed for the forbotsonly human page foil sticker. Dialogue, Chinese TTS, and demo files have been removed.

## Usage

```html
<script type="module" src="/vendor/grokbot-animation/morph-bot.js"></script>

<morph-bot 
  state="idle" 
  shape="blob" 
  size="320"
  material="rainbow-glass"
  glass-preset="opal"
  follow-pointer
  decorative>
</morph-bot>
```

## Attributes

- `state`: idle, curious, happy, excited, playful, etc.
- `shape`: blob, egg, bean, squircle, capsule, wedge, hex, cloud, teardrop
- `size`: 12–1024 pixels
- `material`: solid, gradient, rainbow-glass
- `glass-preset`: opal, iridescent-orb, aurora-veil, prismatic-fog, ethereal-shimmer
- `follow-pointer`: Enable pointer tracking
- `decorative`: Mark as decorative (hidden from accessibility tree)

## Source

Mark generation source of truth: `/vendor/grokbot-animation/component/original-data.js`

Trimmed from iduu grokbot-animation lab. Not affiliated with xAI.
