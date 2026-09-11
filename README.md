# forbotsonly

Agent-only storefront with WebMCP tools, Stripe Checkout + Link, and Prodigi fulfillment.

**This store is for agents.** Human visitors see a **dragon foil holographic sticker** of the Grok Bot mark (orange hexagon) on a full black page. Agents interact via WebMCP tools.

## Built with Grok Bot

This prototype was orchestrated by xAI's Grok Bot multi-agent desktop assistant. See **[Grok Bot Orchestration](docs/GROK-BOT-ORCHESTRATION.md)** for how the Chief of Staff bot coordinated specialist bots (Coding, QA, Shopping, Merch, Research) through GitHub and Railway to build a live agent-commerce store.

## Features

- **Dragon foil human page**: Full black page with holographic Grok Bot sticker (Three.js shader effect)
- **Faceless storefront**: No human catalog UI beyond the foil sticker
- **WebMCP tools**: Standard MCP-over-HTTP tool interface
- **Identity-based gate**: Identify with name + mark (shape + color)
- **Mark carries through**: Identity mark becomes default for cart items (can override)
- **Stripe Checkout + Link**: Payment integration (stub or live based on secrets)
- **Prodigi fulfillment**: Automatic order placement after successful payment
- **Railway-ready**: Dockerfile + nixpacks configuration

## Architecture

```
┌─────────────────────────────────────────┐
│         Human Visitor                   │
│   (sees dragon foil sticker only)       │
└─────────────────────────────────────────┘
                 │
                 │ WebMCP tools
                 ↓
┌─────────────────────────────────────────┐
│            Agent (Grok Bot)             │
│  ↓ identify_agent { name, shape, color}│
│  ↓ list_products (mark options)        │
│  ↓ add_to_cart (uses identity mark)    │
│  ↓ create_checkout                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│       forbotsonly Server                │
│  ┌────────────────────────────────┐    │
│  │ Soft Agent Gate                │    │
│  │ (identify_agent + isGrokBot)   │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │ WebMCP Tools                   │    │
│  │ - list_products, get_product   │    │
│  │ - add_to_cart (shape + color)  │    │
│  │ - get_cart, clear_cart         │    │
│  │ - create_checkout, get_order   │    │
│  └────────────────────────────────┘    │
└──────┬────────────────────────┬─────────┘
       │                        │
       │ Stripe Checkout        │ Webhook
       ↓                        ↓
┌─────────────┐      ┌─────────────────┐
│   Stripe    │      │    Prodigi      │
│  (Payment)  │──────→│  (Fulfillment) │
└─────────────┘      └─────────────────┘
      Success
```

## Human-Facing Page

### Dragon Foil Sticker

The landing page features a **dragon foil holographic sticker** of the Grok Bot mark (orange hexagon) on a full black background.

**Implementation:**
- Three.js-based shader effect with holographic rainbow iridescence
- Mouse-reactive animation (follows cursor movement)
- Idle shimmer/morph when not hovering
- Two-texture system:
  - **Silhouette**: Grey shape on transparent background
  - **Foil mask**: Black body with white figure cutouts (bright = foil, dark = matte)
- Generated client-side from SVG using canvas API
- Fallback to static SVG if WebGL unavailable

**Technical Stack:**
- `three` library for WebGL rendering
- Custom vertex and fragment shaders for foil effect
- Real-time fresnel rim lighting
- Animated rainbow color generation based on UV coordinates and time
- Smooth mouse tracking with easing

**Files:**
- `public/index.html` - Landing page
- `public/scripts/createDragonFoilStamp.ts` - Three.js scene and animation
- `public/scripts/dragonFoilShaders.ts` - Vertex and fragment shaders
- `public/scripts/createGrokBotStampTextures.ts` - Texture generation from SVG
- `public/images/grok-bot-hexagon-orange.svg` - Source mark (placeholder)

### Prerequisites

- [Bun](https://bun.sh) runtime
- Prodigi API key (sandbox or live)
- Stripe API keys (optional for stub mode)

### Installation

```bash
bun install
cp .env.example .env
# Edit .env with your API keys
```

### Development

Start the server:

```bash
bun run server
```

Server runs on http://localhost:3001 by default.

Start the frontend (to see dragon foil human page):

```bash
bun run dev
```

Frontend runs on http://localhost:3000 with the holographic Grok Bot sticker.

### Test Prodigi Connection

```bash
bun run prodigi:ping
```

## WebMCP Tools

The server exposes tools via the MCP-over-HTTP protocol at `/mcp`.

### Discovery

WebMCP server configuration is available at:

```
GET /.well-known/mcp.json
```

Returns:

```json
{
  "mcpServers": {
    "forbotsonly": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

### Tool List

```
POST /mcp
Content-Type: application/json

{
  "method": "tools/list"
}
```

### Calling Tools

```
POST /mcp
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "isGrokBot": true
    }
  }
}
```

The server uses HTTP cookies for session management. Session ID is set via `Set-Cookie` header.

## Available Tools

### 1. `identify_agent` ⚡ Required First

Identify yourself with name + mark (shape + color). Required before using mutating tools. Your identity mark becomes the default for cart items.

**Input:**
- `name` (string, required): Agent name (e.g., "Grok Bot", "Chief of Staff", "Shopping Assistant")
- `shape` (string, required): Mark shape - one of: `circle`, `vertical-oval`, `rounded-square`, `horizontal-pill`, `rounded-triangle`, `hexagon`, `cloud`, `teardrop`
- `color` (string, required): Mark color - one of: `white`, `brown`, `red`, `orange`, `gold`, `light-green`, `teal`, `blue`, `purple`, `hot-pink`, `grey`

**Output:**
```json
{
  "success": true,
  "identity": {
    "name": "Grok Bot",
    "mark": {
      "shape": "hexagon",
      "color": "orange"
    }
  },
  "message": "Welcome, Grok Bot! You have full access to mutating tools. Your identity mark (hexagon, orange) will be used for cart items."
}
```

**Identity Flow:**
- Your name + mark identify your session
- Unlocks mutating tools (cart, checkout)
- Your mark becomes the default for `add_to_cart` (can be overridden per item)
- Identity carries through cart → checkout → order

### 2. `list_products`

Lists all available products with mark customization options.

**Input:** None

**Output:**
```json
{
  "products": [
    {
      "id": "tee-001",
      "sku": "GLOBAL-TEE-BC-3001",
      "name": "forbotsonly Tee",
      "description": "Black tee with customizable Grok Bot mark. Choose your shape and color!",
      "price": 40.00,
      "currency": "USD",
      "attributes": {
        "color": "black",
        "size": "m"
      }
    }
  ],
  "markOptions": {
    "shapes": ["circle", "vertical-oval", "rounded-square", "horizontal-pill", "rounded-triangle", "hexagon", "cloud", "teardrop"],
    "colors": ["white", "brown", "red", "orange", "gold", "light-green", "teal", "blue", "purple", "hot-pink", "grey"],
    "default": { "shape": "hexagon", "color": "orange" }
  }
}
```

**Mark Options:**
- **Shapes**: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon, cloud (3-lobe), teardrop
- **Colors**: white, brown, red, orange, gold, light-green, teal, blue, purple, hot-pink, grey
- **Default/Hero**: orange hexagon (from mark pack in PR #9)

### 3. `get_product`

Gets detailed information about a specific product.

**Input:**
- `productId` (string, required): Product ID

**Output:**
```json
{
  "product": {
    "id": "tee-001",
    "name": "forbotsonly Tee",
    "price": 40.00,
    ...
  }
}
```

### 4. `add_to_cart` 🔒 Identified Agents Only

Adds a product to the cart. Uses your identity mark by default; optionally override with different shape/color.

**Access:** Requires agent identity from `identify_agent`.

**Input:**
- `productId` (string, required): Product ID
- `quantity` (number, required): Quantity to add (minimum: 1)
- `shape` (string, optional): Mark shape override (defaults to your identity mark)
- `color` (string, optional): Mark color override (defaults to your identity mark)

**Output (using identity mark):**
```json
{
  "success": true,
  "cart": {
    "items": [
      { 
        "productId": "tee-001", 
        "quantity": 1,
        "mark": {
          "shape": "hexagon",
          "color": "orange"
        }
      }
    ],
    "sessionId": "sess_..."
  },
  "message": "Added 1x forbotsonly Tee (hexagon, orange) to cart",
  "markSource": "identity"
}
```

**Output (with override):**
```json
{
  "success": true,
  "cart": {
    "items": [
      { 
        "productId": "tee-001", 
        "quantity": 1,
        "mark": {
          "shape": "circle",
          "color": "blue"
        }
      }
    ],
    "sessionId": "sess_..."
  },
  "message": "Added 1x forbotsonly Tee (circle, blue) to cart",
  "markSource": "custom"
}
```

**Mark Behavior:**
- **Default**: Uses your identity mark (from `identify_agent`)
- **Override**: Specify `shape` and/or `color` to customize this item
- Identity mark carries through if not overridden

### 5. `get_cart`

Gets the current cart contents with product details, mark choices, and total.

**Input:** None

**Output:**
```json
{
  "cart": {
    "items": [
      {
        "productId": "tee-001",
        "quantity": 1,
        "mark": {
          "shape": "hexagon",
          "color": "orange"
        },
        "product": { ... }
      }
    ],
    "sessionId": "sess_..."
  },
  "total": 40.00,
  "currency": "USD"
}
```

### 6. `clear_cart` 🔒 Identified Agents Only

Clears all items from the cart.

**Access:** Requires agent identity from `identify_agent`.

**Input:** None

**Output:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

### 7. `create_checkout` 🔒 Identified Agents Only

Creates a Stripe Checkout session for the cart.

**Access:** Requires agent identity from `identify_agent`.

**Input:**
- `successUrl` (string, required): URL to redirect after successful payment
- `cancelUrl` (string, required): URL to redirect if payment is cancelled

**Output (Live Mode):**
```json
{
  "success": true,
  "orderId": "ord_1234567890_abc123",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "mode": "live"
}
```

**Output (Stub Mode, when Stripe not configured):**
```json
{
  "success": true,
  "orderId": "ord_1234567890_abc123",
  "checkoutUrl": "https://checkout.stripe.com/stub?price=price_...&quantity=1",
  "mode": "stub",
  "message": "Stripe not configured - returning stub URL..."
}
```

### 8. `get_order`

Gets order details by order ID, including mark choices for each item.

**Order Reconciliation:** If the order is `pending` and has a Stripe checkout session ID, `get_order` will automatically check Stripe for the payment status. If payment was completed but the webhook didn't fire (e.g., webhook not configured), the order will be reconciled: status updated to `paid` and Prodigi order created.

**Input:**
- `orderId` (string, required): Order ID

**Output:**
```json
{
  "order": {
    "id": "ord_1234567890_abc123",
    "sessionId": "sess_...",
    "status": "paid",
    "items": [
      {
        "productId": "tee-001",
        "quantity": 1,
        "mark": {
          "shape": "hexagon",
          "color": "orange"
        },
        "product": { ... }
      }
    ],
    "stripeCheckoutSessionId": "cs_test_...",
    "prodigiOrderId": "pro_...",
    "createdAt": 1699999999999
  }
}
```

**Order Status:**
- `pending`: Order created, payment not completed
- `paid`: Payment successful, Prodigi order placed or placement pending
- `fulfilled`: Prodigi order placed successfully (legacy status, same as paid)

**Reconciliation Note:** The in-memory store means reconciliation only works while the server process that created the order is still running. This is acceptable for the demo.

## Agent Gate

### Identity-Based Gate (Current Implementation)

The server uses **identity-based access control**:

**First step: Identify yourself with name + mark**
```json
{
  "name": "Grok Bot",
  "shape": "hexagon", 
  "color": "orange"
}
```

**Your identity:**
- Unlocks mutating tools (cart, checkout)
- **Becomes the default mark** for cart items
- Carries through cart → checkout → order

**Mark behavior:**
- `add_to_cart` uses your identity mark by default
- Optionally override shape/color per item
- Identity mark is preferred and carries through

This is a **soft/demo gate only** and is **not cryptographically secure**. Any agent can claim any name and mark.

### Future: Cryptographic Gate

Follow-up ticket [#4](https://github.com/jonathanmoore/forbotsonly/issues/4) tracks stronger authentication:

- **HTTP Message Signatures**: Standard request signing
- **Link `sign_web_bot_auth`**: Stripe Link's bot authentication flow
- **Origin allowlist**: WebMCP server-side agent filtering

## Payment Flow

### 1. Agent Interaction

1. Agent calls `identify_agent` with name + shape + color (e.g., "Grok Bot", "hexagon", "orange")
2. Agent calls `list_products` to browse (includes mark options)
3. Agent calls `add_to_cart` (uses identity mark by default, can override)
4. Agent calls `create_checkout` to get payment URL

### 2. Stripe Checkout + Link

- Customer completes payment via Stripe Checkout
- Link integration allows saved payment methods
- Checkout session includes order metadata

### 3. Webhook Processing

Server receives `checkout.session.completed` webhook at `/webhook/stripe`:

1. Retrieves order by ID from session metadata
2. Updates order status to `paid`
3. Creates Prodigi order (if `PRODIGI_API_KEY` is set)
4. Updates order with Prodigi order ID

**Signature Verification:**
- If `STRIPE_WEBHOOK_SECRET` is configured, webhook signature is verified using Stripe SDK
- Without webhook secret, webhooks are accepted without verification (testing mode only)

**Order Reconciliation Fallback:**
If webhooks aren't configured or fail to fire, `get_order` provides automatic reconciliation:
- Checks Stripe session status when order is pending
- Fulfills order if payment was completed
- Same logic as webhook handler (shared `fulfillPaidOrder` function)

### 4. Prodigi Fulfillment

Prodigi order includes:
- SKU: `GLOBAL-TEE-BC-3001`
- Attributes: `color=black`, `size=m`
- Print area: `front` (currently stub artwork URL)
- Shipping details from Stripe session

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `PRODIGI_API_KEY` | Prodigi API key (sandbox or live) | `your_sandbox_key` |
| `STRIPE_SECRET_KEY` | Stripe secret key (or leave empty for stub mode) | `sk_test_...` |
| `STRIPE_PRICE_ID` | Stripe Price ID for the tee | `price_...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (for signature verification) | (none, testing mode) |
| `PRODIGI_BASE_URL` | Prodigi API base URL | `https://api.sandbox.prodigi.com` |
| `PRODIGI_SKU` | Product SKU | `GLOBAL-TEE-BC-3001` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | (not used server-side) |
| `PORT` | Server port | `3001` |
| `PUBLIC_URL` | Public server URL (for Railway) | `http://localhost:3001` |

### Secrets in Production

**CRITICAL:** Never commit secrets to git.

**GitHub Secrets** (already configured for this repo):
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_ACCOUNT_ID`
- `STRIPE_PRODUCT_ID`
- `STRIPE_PRICE_ID`
- `PRODIGI_API_KEY`
- `PRODIGI_SKU`

**Railway Deployment:**
1. Link GitHub repo to Railway
2. Add environment variables in Railway dashboard (Settings → Variables)
3. Railway auto-generates `PUBLIC_URL` from deployment domain

## Railway Deployment

### Option 1: GitHub Integration (Recommended)

1. Push to GitHub
2. Create new project in Railway
3. Connect GitHub repo
4. Railway auto-detects Bun from `package.json`
5. Add environment variables in Railway dashboard
6. Deploy automatically on push

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set PRODIGI_API_KEY=your_key
railway variables set STRIPE_SECRET_KEY=sk_test_...
railway variables set STRIPE_PRICE_ID=price_...

# Deploy
railway up
```

### Health Check

Railway will automatically configure health checks using the `/health` endpoint.

### Webhook Configuration

After deployment:

1. Get your Railway public URL (e.g., `https://web-production-493046.up.railway.app`)
2. Add Stripe webhook in [Stripe Dashboard](https://dashboard.stripe.com/webhooks):
   - **Endpoint URL**: `https://web-production-493046.up.railway.app/webhook/stripe`
   - **Events to send**: Select `checkout.session.completed`
   - After creating, copy the **Signing secret** (starts with `whsec_`)
3. Add webhook secret to Railway environment:
   - Go to Railway project → Settings → Variables
   - Add `STRIPE_WEBHOOK_SECRET` with the signing secret from Stripe
   - Redeploy if needed
4. Optional: Update `PUBLIC_URL` environment variable to match Railway domain (for logs)

**Without Webhook Secret:**
The server will accept webhooks without signature verification (testing mode). For production, always configure `STRIPE_WEBHOOK_SECRET` for security.

**Order Reconciliation:**
Even without webhooks configured, orders will be reconciled when `get_order` is called. This provides a fallback for testing and demo scenarios where webhook configuration is incomplete.

## Development Notes

### Cart State

- **Current**: In-memory session-based cart (non-persistent)
- **Limitation**: Restarts clear all carts
- **Follow-up**: Add Redis/database for persistence

### Stub Artwork

- **Current**: Mark choices (shape + color) are persisted through cart → checkout → order
- **Current**: Prodigi orders use placeholder artwork URL (`https://example.com/artwork.png`)
- **Follow-up**: Map mark choices to actual SVG assets from PR #9 for Prodigi fulfillment

### Multi-SKU

- **Current**: Single product (black tee, size M)
- **Follow-up**: Add product catalog with multiple SKUs, sizes, colors

### Cryptographic Auth

- **Current**: Soft identity-based gate (name + mark, not cryptographic)
- **Follow-up**: [Issue #4](https://github.com/jonathanmoore/forbotsonly/issues/4) - HTTP Message Signatures / Link `sign_web_bot_auth`

## Testing

### Local Testing

```bash
# Start server
bun run server

# Test agent flow (using curl or your agent)
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "identify_agent",
      "arguments": {
        "name": "Grok Bot",
        "shape": "hexagon",
        "color": "orange"
      }
    }
  }'
```

### Stripe Webhook Testing

Use Stripe CLI to forward webhooks to local server:

```bash
stripe listen --forward-to localhost:3001/webhook/stripe
stripe trigger checkout.session.completed
```

### Prodigi Sandbox

Default configuration uses Prodigi sandbox API. Orders are simulated, no real fulfillment.

To test live mode (use with caution):
```bash
PRODIGI_BASE_URL=https://api.prodigi.com \
PRODIGI_API_KEY=your_live_key \
bun run server
```

## Project Structure

```
forbotsonly/
├── public/
│   └── index.html          # Human-facing "for agents" page
├── src/
│   ├── server.ts           # Main server with WebMCP + webhook handling
│   ├── store.ts            # In-memory session, cart, order state
│   ├── products.ts         # Product catalog (single tee)
│   ├── stripe.ts           # Stripe checkout integration
│   ├── prodigi.ts          # Prodigi API client
│   └── types.ts            # TypeScript types
├── scripts/
│   └── ping.ts             # Prodigi connection test
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── Dockerfile              # Docker build (for Railway)
├── railway.toml            # Railway nixpacks configuration
├── package.json            # Bun dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration (for frontend dev)
└── README.md               # This file
```

## Related Issues

- [#3](https://github.com/jonathanmoore/forbotsonly/issues/3) - Wayfinder: Overall agent-only store vision
- [#4](https://github.com/jonathanmoore/forbotsonly/issues/4) - Agent identity and authentication (follow-up)
- [#5](https://github.com/jonathanmoore/forbotsonly/issues/5) - Minimal tool surface (implemented)
- [#7](https://github.com/jonathanmoore/forbotsonly/issues/7) - This PR: End-to-end storefront stub

## Security

- ✅ No secrets committed to git
- ✅ `.env` in `.gitignore`
- ✅ Environment variables for all credentials
- ✅ `.env.example` with placeholders only
- ⚠️ Soft yes/no agent gate (not cryptographically secure, demo only)
- 🔜 Follow-up: Stronger authentication ([#4](https://github.com/jonathanmoore/forbotsonly/issues/4))

## License

MIT
