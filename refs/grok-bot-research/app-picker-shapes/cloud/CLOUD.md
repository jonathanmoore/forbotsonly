# Cloud shape — Character picker rebuild refs

## Best path for Coding (clearer than bare `05-cloud.png`)

Folder: `/workspace/merch/refs/grok-bot-research/app-picker-shapes/cloud/`

| File | Use |
|------|-----|
| **`preview-tight.png`** | **#1 visual bar** — large picker preview; classic 5-lobe cloud; dark slanted pills **fully inside** (upper body, slight right bias, strong slant) |
| `preview-wide.png` | Same preview, more chrome context |
| `picker-row.png` | Grid silhouettes only (no eyes) — lobe outline check |
| `05-cloud-full.png` | Full Character screen |
| **`product-cloud-silhouette.svg`** | **Product geometry** — circle-union outline from `SHAPES.cloud` (`source/chunks/1_bvoktjb3d2f.js`) |
| `product-cloud-contained-eyes.svg` | Silhouette + **approximate** contained ellipses only — **re-lay eyes to match `preview-tight.png`** (or product eye solver); do not treat eye coords as final |

Also: parent `../05-cloud.png` (same full shot as before).

## Product lobes (`HEAD_C` = 114.2705)

Offsets `(dx, dy, r)` from HEAD_C:

`[-62,+26,56]`, `[+62,+26,54]`, `[0,+34,62]`, `[-24,-30,62]`, `[+38,-26,54]`

`solid` weights in same chunk: `[[-62,26,10,58],[62,26,-14,56],[0,34,24,64],[-24,-30,-22,64],[38,-26,16,56]]`

## Eyes (contained)

Picker / filled avatar style: dark pills **inside** orange mass — not marketing overflow.

Do **not** paste blob overflow eye `d`s onto cloud.

## Avoid

- `renders/our-cloud.png` — wrong outline; eye overflows edge  
- `pr9-overflow/grok-bot-cloud-*.svg` — overflow eyes on cloud  
- `pr9-picker/grok-bot-cloud-*.svg` — hand path, not product circle-union  
