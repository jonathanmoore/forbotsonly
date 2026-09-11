# Grok Bot Animation (Trimmed for forbotsonly)

Minimal vendor copy of grokbot-animation lab, trimmed to essential files for mark generation and decorative sticker usage.

## What's Kept

**Mark Generation (Source of Truth)**
- `component/original-data.js` - Shape geometry and state data for `scripts/generate-marks.mjs`

**Decorative Sticker Runtime (Public Deployment)**
- `public/vendor/grokbot-animation/` - Minimal morph-bot element for foil sticker
- Stripped of dialogue, Chinese TTS, pinyin-pro, animalese-tts, docs, downloads, demos

## Structure

```
vendor/grokbot-animation/
├── component/
│   ├── original-data.js        ← Mark generation source
│   ├── morph-bot.js            (trimmed)
│   ├── grok-bot-engine.js
│   ├── catalog.js
│   ├── materials.js
│   └── runtime/                (minimal physics/rendering)
├── original-data.js            (re-export from component/)
├── grok-bot-engine.js          (re-export)
├── catalog.js                  (re-export)
└── materials.js                (re-export)
```

Public deployment uses `/public/vendor/grokbot-animation/` (separate trimmed copy).

## Source

Trimmed from iduu grokbot-animation lab. Not affiliated with xAI.
