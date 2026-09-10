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

This project uses the Prodigi sandbox API for print-on-demand fulfillment.

#### 1. Create a Prodigi Account

Sign up at [dashboard.prodigi.com/register](https://dashboard.prodigi.com/register)

#### 2. Get Your API Key

1. Log in to the Prodigi dashboard
2. Navigate to **Settings → Integrations → API**
3. Copy your **sandbox API key**

#### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
PRODIGI_API_KEY=your_sandbox_api_key_here
```

**Important:** The sandbox environment uses the host `api.sandbox.prodigi.com`. This is configured by default in the client.

### Test the Connection

```bash
bun run prodigi:ping
```

This will attempt to fetch a product from the Prodigi API to verify your configuration.

## Prodigi Client Usage

```typescript
import { createProdigiClient } from './src/prodigi';

const client = createProdigiClient();

// Get a product by SKU
const product = await client.getProduct('GLOBAL-TSHT-BLCK-XXL');

// Create an order
const order = await client.createOrder({
  // order payload
});

// Get order details
const orderDetails = await client.getOrder('order-id');
```
