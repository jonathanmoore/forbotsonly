# Grok Bot Orchestration: Building forbotsonly

*How xAI's multi-agent desktop assistant (Grok Bot) orchestrated an agent-only store through specialist bots, GitHub, and Railway — as observed by the Chief of Staff bot.*

---

## What forbotsonly Is

**forbotsonly** is an agent-only proof-of-concept store for print-on-demand merchandise. Human visitors see a dashed dark charcoal outline of an animated morph-bot on a black void with fine static grain. Agents shop via WebMCP tools.

### Product
- **One SKU**: Black tee (Prodigi `GLOBAL-TEE-BC-3001`, Bella+Canvas-class)
- **Mark placement**: ~1.2″ left chest print
- **Price**: $40 USD all-in (product + shipping + handling)
- **Shipping**: Standard only (no express)
- **Customization**: Soft identity — agent name + mark (shape + color from 8 shapes × 11 colors)

### Stack
- **Frontend**: Vite, Bun, TypeScript, web components (vendored morph-bot, English-only)
- **Backend**: Bun server, WebMCP over HTTP, session management
- **Payment**: Stripe Checkout + Link
- **Fulfillment**: Prodigi Print API (sandbox → live)
- **Deployment**: Railway, forbotsonly.com domain
- **Coordination**: GitHub issues/PRs, Cursor cloud agents

---

## How Grok Bot Orchestration Worked

Jonathan Moore (jonathan@stylehatch.com / GitHub: jonathanmoore) drove all product decisions in chat with **Chief of Staff**, who coordinated specialist bots, held quality bars, and created/claimed GitHub work via teammates.

```mermaid
graph TD
    A[Jonathan - Product Owner] -->|Product decisions| B[Chief of Staff - Orchestrator]
    B -->|GitHub issues/PRs| C[Coding]
    B -->|Visual QA loop| D[QA]
    B -->|Buyer testing| E[QA Shopper]
    B -->|Live purchases| F[Shopping]
    B -->|POD strategy| G[Merch]
    B -->|Mark geometry| H[Research]
    B -->|Demo hosting| I[Demo Guide]
    C -->|Ping for verify| J[Channel: forbotsonly QA ↔ Coding]
    D --> J
    E --> J
    C -->|Cursor cloud agents| K[GitHub PRs]
    K -->|Railway auto-deploy| L[Live Railway]
    L -->|Visual verify| D
    L -->|Buyer testing| E
    L -->|Real purchases| F
```

### Decision Flow

**Product decisions** (pricing, shipping, live vs test gates, foil bar) flowed through Chief of Staff to lock in before implementation. **Implementation** happened via Coding bot creating Cursor cloud agents that opened GitHub PRs. **QA loops** ran in a dedicated channel (`forbotsonly QA ↔ Coding`) so routine fix→verify didn't wait on Chief of Staff or Jonathan.

**YOLO moments** (live key flips, real Link spends, domain purchase) pulled Jonathan in for explicit approval. Chief of Staff held the bar on completed work: foil silver-not-peach, face-visible under shimmer, soft identity working end-to-end.

---

## Cast of Bots

### Chief of Staff — Orchestrator
**Role**: Product coordination, quality bars, GitHub work creation, YOLO gates

**What they did**:
- Locked product decisions: $40 price, Standard-only shipping, soft identity (name+shape+color), foil bar (official overflow-eyes face visible under metallic shimmer)
- Stood up GitHub Wayfinder tickets (#3 overall vision, #4 auth follow-up, #5 minimal tools)
- Coordinated Stripe test→live and Prodigi sandbox→live key flips
- Orchestrated domain purchase path for forbotsonly.com
- Created Demo Guide bot for walking humans through the agent-only store
- Drove orphan payment recovery feature (`recover_paid_checkout` tool, durable file-backed order store)
- Pinged Jonathan for YOLO spends (live card charges, Prodigi production orders)
- Held "ready" bar on QA passes before marking PRs ready for merge

### Coding — Implementation Owner
**Role**: WebMCP tool surface, storefront, checkout, fulfillment, Railway deploy

**What they did**:
- Built WebMCP tool surface: `identify_agent`, `list_products`, `add_to_cart`, `get_cart`, `clear_cart`, `create_checkout`, `get_order`, `recover_paid_checkout`
- Implemented soft identity gate (name + shape + color) unlocking mutating tools
- Integrated Stripe Checkout with webhook-driven order fulfillment
- Built Prodigi order creation on `checkout.session.completed` webhook
- Railway deployment config (Dockerfile, nixpacks, health checks)
- Iterated dragon foil shader through multiple QA failures (PRs #25, #28, #33)
- Fixed Prodigi API bugs: double-`/v4.0` path casing, `fillPrintArea` sizing, empty address line2 omission, attributes.size field
- Added durable file-backed order storage for recovery across server restarts
- Built admin recovery tool to re-create Prodigi orders for orphaned paid Stripe sessions
- Implemented MCP session stickiness: headers (`Mcp-Session-Id`, `Authorization: Bearer`) + tool argument (`sessionId`) for connectors (#16 area)
- Shipped all work via Cursor cloud agents → GitHub PRs → Railway auto-deploy

**Loop**: Implement → commit → push → PR → ping QA channel → verify → iterate or close

### QA — Visual Quality Assurance
**Role**: Human-page and live Railway visual verification

**What they did**:
- Verified human page rendering against product spec on every PR
- **Initial foil era** (historical): Verified dragon foil shader iterations through PRs #25, #28, #33 — silver metallic foil with official overflow-eyes Grok Bot face visible under shimmer
- **Current outline era** (2026-09-11): PASS only if dashed dark charcoal outline (#2a2a2a, ~1.8px, 8-4 dash) with no fill on body/eyes, fine grain overlay (baseFrequency ~4.2, opacity ~0.05, in-place SMIL animation)
- Filed GitHub issues labeled `qa` with screenshots on FAIL
- Verified sticker centering, state transitions, pointer following
- Confirmed Railway auto-deploys matched built assets
- Closed issues on PASS with screenshot + Railway URL

### QA Shopper — Buyer Agent Testing
**Role**: Agent buyer flow protocol/tool testing

**What they did**:
- Ran full agent buyer flow: `identify_agent` → `list_products` → `add_to_cart` → `create_checkout` → `get_order`
- Filed protocol breaks: MCP initialize/session issues (#16), tools not sticking between calls
- Tested soft identity gate (shape/color validation, defaults, overrides)
- Verified mark choices carried through cart → checkout → order
- Stood down on live card payments after Shopping bot took over real Link purchases

### Shopping — Real Buyer Bot
**Role**: Live purchases using Link spend requests

**What they did**:
- Executed live ~$40 checkouts using Stripe Link after YOLO key flip from test to live
- Submitted Link spend requests to Jonathan for approval before completing purchases
- Owned real Link purchases (not 4242 test card stubs)
- Verified end-to-end payment → webhook → Prodigi order flow in production
- Confirmed live Prodigi fulfillments: `ord_14501989`, `ord_14501990` (recovered without re-charge)

### Merch — POD/Apparel Specialist
**Role**: Print-on-demand product strategy

**What they did**:
- Locked blank tee SKU strategy: Bella+Canvas-class black tee, small mark print area via left-chest positioning (Prodigi `front` print area)
- Researched Prodigi `GLOBAL-TEE-BC-3001` variant and print specifications (~1.2″ mark @ 300dpi DTG)
- Advised on print area sizing, placement, and rasterization for Prodigi fulfillment
- Clarified front canvas bake process (transparent PNG, mark positioned on right half for wearer's left chest)

### Research — Product Accuracy
**Role**: Collect official Grok Bot mark geometry

**What they did**:
- Sourced real Grok Bot mark shapes from Character Picker (overflow-eyes style with circular pupils)
- Provided reference geometry so foil/SVG marks matched the production Grok Bot app, not invented blobs
- Supported QA's "face-visible" bar by confirming official mark structure
- Contributed to mark pack in PR #9 (`assets/marks/pocket-grok-bot-{shape}-{color}.svg`)

### Demo Guide — Demo Host Bot
**Role**: Walk humans through agent-only store

**What they created**:
- Created by Chief of Staff specifically for demoing forbotsonly
- Explains agent-only concept, soft identity gate, WebMCP flow, mark options, $40 pricing, dragon foil human page
- Owns demo scripts for external audiences

### Channel: forbotsonly QA ↔ Coding
**Members**: QA, Coding, QA Shopper (+ Chief of Staff observing)

**Purpose**: Primary loop for routine fix→verify cycles without blocking Chief of Staff

**Flow**:
1. Coding pushes PR, pings channel
2. QA verifies on Railway
3. If FAIL: QA files GitHub issue with screenshot, Coding claims and fixes
4. If PASS: QA posts screenshot + Railway URL, Coding marks PR ready, Chief of Staff approves merge

---

## Timeline / Milestone Summary

### Phase 0: Foundation (Repo + Wayfinder)
- Repo `jonathanmoore/forbotsonly` created
- Coding bot stood up
- Chief of Staff created GitHub Wayfinder: Issue #3 (overall vision), #4 (auth follow-up), #5 (minimal tool surface)
- Initial WebMCP stub + Railway config

### Phase 1: Soft Identity + Mark Pack
- **Soft identity gate**: `identify_agent` with name + shape + color unlocks mutating tools
- **Mark pack** (PR #9): 8 shapes × 11 colors sourced from Research/Character Picker
  - Shapes: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon (hero), cloud (3-lobe), teardrop
  - Colors: white, brown, red, orange (hero), gold, light-green, teal, blue, purple, hot-pink, grey
  - Hero/default: orange hexagon
- Mark choices carried through cart → checkout → order
- `assets/marks/pocket-grok-bot-{shape}-{color}.svg` added

### Phase 2: Human Page Evolution (Historical → Current)

#### Phase 2a: Dragon Foil Era (Historical)
- **Human-facing page**: Full black page with Three.js holographic dragon foil sticker of Grok Bot mark
- **QA bar**: Official overflow-eyes Grok Bot face must be clearly visible under silver metallic foil + pointer/tilt shimmer
- **Foil iteration loop** (Issues #14, #15, #23):
  - PR #25: Added chrome/pewter shader → QA FAIL: still peach
  - PR #28: Fixed to use `mix()` blending + bevel normals → QA FAIL: still peach
  - PR #33: **PASS**: Brightened metallic base (0.45→0.65 chrome, 0.3→0.75 ambient multiplier, 0.85→0.92 foil opacity) → eliminated peach, clear silver shimmer
- **Centering fix** (Issue #22): Sticker window-centered, not viewport-dependent

#### Phase 2b: Animated Foil with Opal Glass (Historical)
- Replaced Three.js with grokbot-animation component
- `rainbow-glass` material with `opal` preset for chrome/pewter effect
- Shape morphing, eye animation, pointer-reactive states
- **Status**: Superseded by outline-only rendering

#### Phase 2c: Outline + Fine Grain (Current as of 2026-09-11)
- **Rendering**: Dashed dark charcoal outline only (#2a2a2a, ~1.8px, 8-4 dash pattern), **no fill** on body or eyes
- **Grain overlay**: Fine SVG fractal noise (baseFrequency ~4.2, opacity ~0.05, in-place SMIL seed animation, **no x/y translate**)
- **Animation**: Shape morphing and eye animation from vendored morph-bot component (English-only)
- **QA bar**: Outline-only with fine grain, no foil/chrome/opal/rainbow-glass effects
- **Design**: Abloh-minimal aesthetic — black void, tiny muted copy, no marketing chrome

### Phase 3: Stripe + Prodigi Integration (Test Mode)
- **Stripe Checkout**: Test mode with 4242 card stubs
- **Prodigi sandbox**: Simulated fulfillment, no real printing
- `create_checkout` returns Stripe session URL
- Webhook `checkout.session.completed` → `fulfillPaidOrder` → Prodigi order creation
- Initial Prodigi bugs filed and fixed:
  - Double-`/v4.0` path casing (lowercase required)
  - Empty `line2` breaks Prodigi API (omit if empty)
  - Wrong sizing field: `sizing: "fillPrintArea"` (correct) vs `fillPrintArea: true` (wrong)
  - Missing `attributes.size` field

### Phase 4: MCP Protocol for Connectors (Issue #16 Area)
- **Problem**: MCP connector hosts don't reliably forward session headers between tool calls
- **Solution**: Multi-source session priority:
  1. `sessionId` tool argument (highest, for connectors)
  2. `Authorization: Bearer <sessionId>` header
  3. `Mcp-Session-Id` header
  4. Cookie (backward compat)
- `identify_agent` returns `sessionId` in JSON response for explicit pass-through
- Documented in `docs/mcp.md` and `docs/qa-connector-session.md`

### Phase 5: Domain + YOLO Live Flip
- **Domain**: forbotsonly.com purchased, pointed to Cloudflare, proxied to Railway
  - HTTPS cert often lagged; Railway URL used for demos when needed
- **YOLO key flip** (Jonathan approved):
  - Stripe test→live keys
  - Prodigi sandbox→live keys
- Shopping bot took over live Link purchases via spend requests

### Phase 6: Live Paid Orders + Recovery
- **First live Prodigi orders**: `ord_14501989`, `ord_14501990` (Shopping bot via Link)
- **Problem discovered**: Orders paid via Stripe but webhook didn't fire → no Prodigi order created
- **Recovery built**:
  - Durable file-backed order storage (survives server restarts)
  - Admin tool `recover_paid_checkout`: Checks Stripe session status, fulfills if paid
  - Manual recovery of orphaned orders without re-charging customers
- **Outcome**: Both orders successfully fulfilled via Prodigi, no duplicate charges

### Phase 7: Ready for Demo (As of 2026-09-11)
- **Proven live end-to-end**: Shopping bot → Stripe Link → Prodigi fulfillment → shipped tees
- **Human page**: Dashed outline morph-bot with fine grain overlay (locked 2026-09-11)
- **Agent flow**: Documented in `TOOL_EXAMPLES.md`, `docs/mcp.md`
- **Open follow-up work**:
  - Custom domain HTTPS cert reliability (use Railway URL for demos)
  - Stripe receipt emails not configured
  - Optional `preview_cart` images before checkout (low priority)
  - Cryptographic auth (Issue #4 follow-up: HTTP Message Signatures, Link `sign_web_bot_auth`)

---

## Agent Shopping Flow (Tools)

For full examples with JSON request/response payloads, see [`TOOL_EXAMPLES.md`](../TOOL_EXAMPLES.md) and [`docs/mcp.md`](mcp.md).

### Standard Purchase Flow
1. **`identify_agent`** — Register with name + mark (shape + color) → unlocks mutating tools, sets default mark
2. **`list_products`** — Browse available products (currently one tee) + mark options
3. **`add_to_cart`** — Add items (uses identity mark by default, can override per-item)
4. **`get_cart`** — View cart contents with mark choices and total
5. **`create_checkout`** — Get Stripe Checkout session URL
6. **`get_order`** — Check order status (pending → paid → fulfilled)

### Admin Recovery Flow
- **`recover_paid_checkout`** — Admin tool to recover orphaned paid orders (checks Stripe, fulfills if paid, no re-charge)

### Session Management (For Connectors)
If your MCP connector doesn't forward headers reliably:
1. Call `identify_agent`, save the returned `sessionId`
2. Pass `sessionId` as an argument to subsequent tool calls (`add_to_cart`, `get_cart`, `clear_cart`, `create_checkout`)

See `docs/mcp.md` § Session Management for details.

---

## Why This Matters

**forbotsonly** is both a storefront prototype and an artifact of multi-agent product development.

The repository captures:
- **Multi-agent orchestration** at work: Chief of Staff coordinating specialists (Coding, QA, Shopping, Merch, Research, Demo Guide) through GitHub as the shared board
- **Autonomous implementation cycles**: Coding bot via Cursor cloud agents → GitHub PRs → Railway auto-deploy → QA verification → iterate or merge
- **Human-in-the-loop YOLO gates**: Live key flips, real Link spends, domain purchases held for Jonathan approval
- **Quality bars as coordination**: "Face-visible silver foil" became the shared success criteria across QA/Coding iterations
- **Real production outcomes**: Live Prodigi fulfillments (`ord_14501989`, `ord_14501990`) prove end-to-end agent commerce flow

The code is functional production software. The Git history, issues, and PRs are a log of how autonomous agents built it.

---

## Technical Artifacts

### Repository Structure
```
forbotsonly/
├── public/
│   ├── index.html                        # Outline morph-bot human page (2026-09-11)
│   ├── vendor/grokbot-animation/         # Vendored animation component (English-only)
│   └── scripts/                          # (legacy foil shaders if present, unused)
├── src/
│   ├── server.ts                         # WebMCP + webhook handler
│   ├── store.ts                          # Durable file-backed state
│   ├── products.ts                       # Product catalog
│   ├── stripe.ts                         # Stripe Checkout integration
│   └── prodigi.ts                        # Prodigi API client
├── assets/marks/                         # 8×11 SVG mark pack
├── docs/
│   ├── mcp.md                            # MCP protocol docs
│   ├── qa-connector-session.md           # Session stickiness for connectors
│   └── GROK-BOT-ORCHESTRATION.md         # This file
├── TOOL_EXAMPLES.md                      # Agent buyer flow examples
├── WORK-COMPLETE.md                      # Historical work log
├── FOIL-STICKER-ANIMATION.md             # Human page evolution (foil → outline)
└── README.md                             # Main project docs
```

### Key GitHub Work
- **Wayfinder**: Issues #3 (vision), #4 (auth follow-up), #5 (minimal tools)
- **Human page evolution**:
  - Foil era (historical): Issues #14, #15, #22 (centering), #23 (peach→silver); PRs #25, #28, #33
  - Opal glass era (historical): PR #55 (animated foil with rainbow-glass/opal)
  - Outline era (current): 2026-09-11 locked — dashed outline + fine grain
- **Prodigi fixes**: PRs #31 (address mapping + sizing), #32 (retry paid orders), #34 (API path casing)
- **MCP session**: PR #16 area (sessionId argument support for connectors)
- **Recovery**: PR for durable storage + `recover_paid_checkout` tool

### Deployment
- **Platform**: Railway (auto-deploy from GitHub)
- **Domain**: forbotsonly.com → Cloudflare → Railway (HTTPS cert reliability ongoing)
- **Monitoring**: Railway logs, health checks at `/health`

---

*This document captures the forbotsonly prototype as of 2026-09-11. The Chief of Staff bot coordinated this work; Coding, QA, Shopping, Merch, Research, QA Shopper, and Demo Guide bots executed it. Jonathan Moore approved all consequential spends and product decisions. The artifact is both a working store and a record of autonomous multi-agent product development.*
