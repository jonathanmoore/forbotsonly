# forbotsonly

Agent-only storefront demo.

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime

### Installation

```bash
bun install
```

### Prodigi API Configuration

This project uses the Prodigi API for print-on-demand fulfillment.

#### Architecture: Sandbox vs. Live

**Sandbox (Rehearsal)**
- Host: `api.sandbox.prodigi.com`
- Purpose: Testing and development
- Orders are simulated; no real fulfillment or charges

**Live (Production)**
- Host: `api.prodigi.com`
- Purpose: Real customer orders after successful payment
- Orders are fulfilled and shipped; real costs incurred

#### Intended Payment Flow

1. Customer pays via **Stripe Checkout / Link** (live mode)
2. Stripe webhook fires `checkout.session.completed`
3. Webhook handler uses this client to place a **live Prodigi order**
4. Same client code; environment variables switch between sandbox/live

*Note: Stripe integration and webhooks are not implemented in this PR. This is the planned architecture.*

#### 1. Create a Prodigi Account

Sign up at [dashboard.prodigi.com/register](https://dashboard.prodigi.com/register)

#### 2. Get Your API Keys

1. Log in to the Prodigi dashboard
2. Navigate to **Settings → Integrations → API**
3. Generate both **sandbox** and **live** API keys

#### 3. Configure Environment

```bash
cp .env.example .env
```

For development (default):

```bash
PRODIGI_API_KEY=your_sandbox_api_key_here
# PRODIGI_BASE_URL defaults to https://api.sandbox.prodigi.com
```

For production (use secrets manager, NOT .env):

```bash
PRODIGI_API_KEY=your_live_api_key_here
PRODIGI_BASE_URL=https://api.prodigi.com
```

**CRITICAL:** Live API keys must **NEVER** be committed to version control. Use a secrets manager (e.g., Vercel Environment Variables, AWS Secrets Manager, etc.) in production.

### Test the Connection

```bash
bun run prodigi:ping
```

This will attempt to fetch a product from the Prodigi API to verify your configuration.

## Prodigi Client Usage

### Basic Usage

```typescript
import { createProdigiClient } from './src/prodigi';

// Client reads PRODIGI_API_KEY and PRODIGI_BASE_URL from environment
const client = createProdigiClient();

// Get a product by SKU
const product = await client.getProduct('GLOBAL-TSHT-BLCK-XXL');

// Create an order (live mode: real fulfillment)
const order = await client.createOrder({
  // order payload - see Prodigi API docs
});

// Get order details
const orderDetails = await client.getOrder('order-id');
```

### Intended Integration Flow

When a customer completes checkout:

```typescript
// In your Stripe webhook handler (checkout.session.completed)
import { createProdigiClient } from './src/prodigi';

export async function handleStripeWebhook(event) {
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Create LIVE Prodigi order
    // Ensure PRODIGI_BASE_URL=https://api.prodigi.com in production
    const prodigiClient = createProdigiClient();
    
    const order = await prodigiClient.createOrder({
      shippingMethod: 'Standard',
      recipient: {
        name: session.customer_details.name,
        address: {
          // ... from session.shipping_details
        }
      },
      items: [
        {
          sku: 'GLOBAL-TSHT-BLCK-XXL', // Your product SKU
          copies: 1,
          // ... item configuration
        }
      ]
    });
    
    // Store order.id for tracking
  }
}
```

**Note:** Stripe webhook implementation is not included in this PR. The above example shows the intended architecture.
