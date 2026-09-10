# forbotsonly

Agent-only storefront with WebMCP tools, Stripe Checkout + Link, and Prodigi fulfillment.

**This store is for agents.** Human visitors see a simple "for agents only" message. Agents interact via WebMCP tools.

## Features

- **Faceless storefront**: No human catalog UI
- **WebMCP tools**: Standard MCP-over-HTTP tool interface
- **Soft agent gate**: `identify_agent` required; mutating tools restricted to Grok Bot family
- **Stripe Checkout + Link**: Payment integration (stub or live based on secrets)
- **Prodigi fulfillment**: Automatic order placement after successful payment
- **Railway-ready**: Dockerfile + nixpacks configuration

## Architecture

```
┌─────────────┐
│   Agent     │ (Grok Bot, Chief of Staff, Shopping Bot)
└──────┬──────┘
       │ WebMCP tools
       ↓
┌─────────────────────────────────────────┐
│  forbotsonly Server                     │
│  ┌────────────────────────────────┐    │
│  │ Soft Agent Gate                │    │
│  │ (identify_agent + Grok check)  │    │
│  └────────────────────────────────┘    │
│  ┌────────────────────────────────┐    │
│  │ WebMCP Tools                   │    │
│  │ - list_products, get_product   │    │
│  │ - add_to_cart, get_cart        │    │
│  │ - create_checkout, get_order   │    │
│  └────────────────────────────────┘    │
└─────┬───────────────────────────────┬───┘
      │                               │
      │ Stripe Checkout               │ Webhook
      ↓                               ↓
┌─────────────┐              ┌─────────────────┐
│   Stripe    │              │    Prodigi      │
│  (Payment)  │──────────────→│  (Fulfillment) │
└─────────────┘   Success    └─────────────────┘
```

## Quick Start

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

Start the frontend (optional, for testing human page):

```bash
bun run dev
```

Frontend runs on http://localhost:3000 and proxies API calls to the server.

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
      "name": "Grok Bot",
      "family": "Grok"
    }
  }
}
```

The server uses HTTP cookies for session management. Session ID is set via `Set-Cookie` header.

## Available Tools

### 1. `identify_agent` ⚡ Required First

Identifies the agent and establishes session. Required before using other tools.

**Input:**
- `name` (string, required): Agent name (e.g., "Grok Bot", "Shopping Assistant")
- `family` (string, optional): Agent family or type
- `capabilities` (array<string>, optional): List of agent capabilities

**Output:**
```json
{
  "success": true,
  "agent": { "name": "Grok Bot", "family": "Grok" },
  "access": "full",
  "message": "Welcome! You have full access to mutating tools."
}
```

**Access Levels:**
- `full`: Grok Bot family (Grok Bot, Chief of Staff, Shopping Bot, etc.)
- `read-only`: Other agents (can list products, view cart, but not modify)

### 2. `list_products`

Lists all available products.

**Input:** None

**Output:**
```json
{
  "products": [
    {
      "id": "tee-001",
      "sku": "GLOBAL-TEE-BC-3001",
      "name": "forbotsonly Tee",
      "description": "Black tee with left-chest print area",
      "price": 35.00,
      "currency": "USD",
      "attributes": {
        "color": "black",
        "size": "m"
      }
    }
  ]
}
```

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
    "price": 35.00,
    ...
  }
}
```

### 4. `add_to_cart` 🔒 Grok Bot Only

Adds a product to the cart.

**Access:** Requires Grok Bot family identity.

**Input:**
- `productId` (string, required): Product ID
- `quantity` (number, required): Quantity to add (minimum: 1)

**Output:**
```json
{
  "success": true,
  "cart": {
    "items": [
      { "productId": "tee-001", "quantity": 1 }
    ],
    "sessionId": "sess_..."
  },
  "message": "Added 1x forbotsonly Tee to cart"
}
```

### 5. `get_cart`

Gets the current cart contents with product details and total.

**Input:** None

**Output:**
```json
{
  "cart": {
    "items": [
      {
        "productId": "tee-001",
        "quantity": 1,
        "product": { ... }
      }
    ],
    "sessionId": "sess_..."
  },
  "total": 35.00,
  "currency": "USD"
}
```

### 6. `clear_cart` 🔒 Grok Bot Only

Clears all items from the cart.

**Access:** Requires Grok Bot family identity.

**Input:** None

**Output:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

### 7. `create_checkout` 🔒 Grok Bot Only

Creates a Stripe Checkout session for the cart.

**Access:** Requires Grok Bot family identity.

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

Gets order details by order ID.

**Input:**
- `orderId` (string, required): Order ID

**Output:**
```json
{
  "order": {
    "id": "ord_1234567890_abc123",
    "sessionId": "sess_...",
    "status": "paid",
    "items": [ ... ],
    "stripeCheckoutSessionId": "cs_test_...",
    "prodigiOrderId": "pro_...",
    "createdAt": 1699999999999
  }
}
```

**Order Status:**
- `pending`: Order created, payment not completed
- `paid`: Payment successful, Prodigi order placement pending
- `fulfilled`: Prodigi order placed successfully

## Agent Gate

### Soft Gate (Current Implementation)

The server uses a **soft identity check** based on agent name and family:

- **Grok Bot family** patterns: "Grok Bot", "Chief of Staff", "Shopping Bot", "Grok", etc.
- **Full access**: List, cart, checkout tools
- **Read-only access**: Non-Grok agents can list products and view cart

This is **not cryptographically secure**. Any agent can claim to be "Grok Bot".

### Future: Cryptographic Gate

Follow-up ticket [#4](https://github.com/jonathanmoore/forbotsonly/issues/4) tracks stronger authentication:

- **HTTP Message Signatures**: Standard request signing
- **Link `sign_web_bot_auth`**: Stripe Link's bot authentication flow
- **Origin allowlist**: WebMCP server-side agent filtering

## Payment Flow

### 1. Agent Interaction

1. Agent calls `identify_agent` with Grok Bot identity
2. Agent calls `list_products` to browse
3. Agent calls `add_to_cart` to add items
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

1. Get your Railway public URL: `https://your-app.railway.app`
2. Add Stripe webhook in Stripe Dashboard:
   - URL: `https://your-app.railway.app/webhook/stripe`
   - Event: `checkout.session.completed`
3. Update `PUBLIC_URL` environment variable in Railway (optional, for logs)

## Development Notes

### Cart State

- **Current**: In-memory session-based cart (non-persistent)
- **Limitation**: Restarts clear all carts
- **Follow-up**: Add Redis/database for persistence

### Artwork

- **Current**: Stub artwork URL in Prodigi order (`https://example.com/artwork.png`)
- **Follow-up**: Generate/upload artwork, update URL in order creation

### Multi-SKU

- **Current**: Single product (black tee, size M)
- **Follow-up**: Add product catalog with multiple SKUs, sizes, colors

### Cryptographic Auth

- **Current**: Soft agent name matching
- **Follow-up**: [Issue #4](https://github.com/jonathanmoore/forbotsonly/issues/4) - HTTP Message Signatures / Link auth

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
        "family": "Grok"
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
- ⚠️ Soft agent gate (not cryptographically secure)
- 🔜 Follow-up: Stronger authentication ([#4](https://github.com/jonathanmoore/forbotsonly/issues/4))

## License

MIT
