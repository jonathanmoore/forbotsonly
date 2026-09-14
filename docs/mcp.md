# MCP (Model Context Protocol) Integration

## Endpoint

`POST /mcp`

## Discovery

WebMCP discovery is available at `GET /.well-known/mcp.json`

## Protocol

The server implements MCP over HTTP using JSON-RPC 2.0.

### Handshake

1. **Initialize**: Client sends `initialize` method with protocol version and capabilities
2. **Initialized notification**: Client sends `notifications/initialized` (optional, no response expected)
3. **List tools**: Client calls `tools/list` to discover available tools
4. **Call tools**: Client calls `tools/call` to execute specific tools

### Session Management

Sessions are maintained using multiple mechanisms. The server checks these sources in priority order:

1. **`sessionId` tool argument**: Explicit session ID passed as a parameter to tools that support it (`add_to_cart`, `get_cart`, `clear_cart`, `create_checkout`). **Recommended for MCP connector clients** that don't reliably forward session headers between tool calls.
2. **`Authorization: Bearer <sessionId>` header**: Session ID passed as a Bearer token. Useful for programmatic clients.
3. **`Mcp-Session-Id` header**: Durable session ID passed in request header and returned in response header. Recommended for direct HTTP clients.
4. **Cookie**: Traditional `session` cookie (HttpOnly, SameSite=Lax, 24-hour expiry). Maintained for backward compatibility.

#### Connector Client Workflow (When Headers Don't Stick)

If your MCP connector host does not reliably forward `Mcp-Session-Id` headers between tool calls:

1. Call `identify_agent` with your name, shape, and color
2. Extract the `sessionId` from the response JSON
3. Pass `sessionId` as an argument to subsequent tool calls (`list_products`, `get_product`, `add_to_cart`, `clear_cart`, `create_checkout`, `get_cart`, `preview_cart`)

Example:
```javascript
// Step 1: Identify
const identifyResult = await callTool('identify_agent', {
  name: 'Grok Bot',
  shape: 'wedge',
  color: 'cyan'
});
const sessionId = identifyResult.sessionId; // Save this!

// Step 2: Use sessionId in subsequent calls
await callTool('list_products', {
  sessionId: sessionId  // Pass it explicitly
});

await callTool('add_to_cart', {
  productId: 'tee-001',
  quantity: 1,
  size: 'm',
  sessionId: sessionId  // Pass it explicitly
});
```

#### Direct HTTP Client Workflow (Headers Stick)

If your client reliably sends headers with every request, use the header-only path:

1. Call `initialize` with an `Mcp-Session-Id` header
2. The server returns `Mcp-Session-Id` in the response header (and `Set-Cookie`)
3. Send the same `Mcp-Session-Id` header with every subsequent request

No need to pass `sessionId` as a tool argument.

### Request Format

All requests must be valid JSON-RPC 2.0:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "client-name",
      "version": "1.0.0"
    }
  }
}
```

### Response Format

All responses are valid JSON-RPC 2.0 envelopes:

**Success**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "forbotsonly",
      "version": "1.0.0"
    }
  }
}
```

**Error**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found: unknown/method"
  }
}
```

### Supported Methods

- `initialize`: Initialize the MCP session
- `notifications/initialized`: Notification that initialization is complete (returns 204 No Content)
- `tools/list`: List all available tools
- `tools/call`: Execute a specific tool

### CORS

All endpoints support CORS with permissive settings:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Example Flow

```bash
# 1. Initialize
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: my-session-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "client", "version": "1.0.0"}
    }
  }'

# 2. Send initialized notification
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: my-session-123" \
  -d '{
    "jsonrpc": "2.0",
    "method": "notifications/initialized"
  }'

# 3. List tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: my-session-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'

# 4. Call a tool
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: my-session-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_products",
      "arguments": {}
    }
  }'
```

## Available Tools

- `identify_agent`: Register agent identity (required for cart/checkout operations)
- `list_products`: List all available products (optional `sessionId` parameter)
- `get_product`: Get details for a specific product (optional `sessionId` parameter)
- SHOW product image to human (ATTACH/DISPLAY shirt photo before asking size)
- `add_to_cart`: Add items to cart (requires identity, size required after showing product)
- `get_cart`: View cart contents
- `clear_cart`: Empty the cart (requires identity)
- `preview_cart`: Preview cart items with mark visualizations (REQUIRED before payment)
- `complete_payment`: Complete payment with Link shared_payment_token (preferred agent API path)
- `create_checkout`: Create Stripe Checkout session (browser fallback if native request_virtual_card unavailable)
- `get_order`: Get order details and status
- `recover_paid_checkout`: Admin tool for recovering orphaned orders

## Agent Payment Flow

### Primary Path: API Payment with Link SPT (Preferred)

1. **Identify**: `identify_agent` with your profile shape+color
2. **Browse**: `list_products` to see catalog (returns productImageUrl for YOUR mark)
3. **Show product**: ATTACH/DISPLAY product image (shirt photo) to human in chat
4. **Ask size**: After showing product, ask human which size they want (s/m/l/xl/2xl/3xl)
5. **Shop**: `add_to_cart` with productId, quantity, and size
6. **Preview**: `preview_cart` + ATTACH images in chat to human (flat-lay + mark close-up)
7. **Confirm shipping**: Use Link MCP `list_shipping_addresses` → confirm city/ZIP with human (US-only)
8. **Request approval**: Call native `request_virtual_card` (Cursor spend-approval UI, NOT a Link MCP tool) with:
   - amountCents: 4000
   - merchantName: "forbotsonly"
   - merchantUrl: store URL
   - lineItems: [{ description: "Grok Bot Tee", amountCents: 4000 }]
9. **Wait for approval**: Human approves spend request in Cursor UI
10. **Get SPT**: Call Link MCP `get_spend_request` with `include: "shared_payment_token"` to retrieve SPT
11. **Pay**: Call `complete_payment` with sharedPaymentToken + confirmed shippingAddress
12. **Done**: Order → `awaiting_approval` (admin review before Prodigi)

### Fallback Path: Browser Checkout (If Native Spend UI Unavailable)

If your host platform does NOT expose native `request_virtual_card` (platform limitation):
1. Follow steps 1-7 above
2. Call `create_checkout` with `shippingConfirmed: true` → returns checkoutUrl
3. Human completes payment in browser at checkoutUrl with Link

**CRITICAL - URL HANDLING:** If using browser fallback, pass the checkoutUrl EXACTLY as returned — NEVER truncate, modify, or parse it. Stripe Checkout Session URLs contain fragment identifiers (#) that must remain intact. Truncating causes "This link is incomplete: Use the unmodified checkout URL" Stripe error. This is a key reason API payment (complete_payment + SPT) is strongly preferred: agents never handle checkout.stripe.com URLs.

**CRITICAL DISTINCTIONS:**
- `request_virtual_card` is a **Cursor-native spend-approval UI tool**, NOT a Link MCP tool
- Link MCP tools: `get_userinfo`, `list_payment_methods`, `list_shipping_addresses`, `list_spend_requests`, `get_spend_request`, `sign_web_bot_auth`, `report_agent_observation`
- DO NOT call nonexistent "Link MCP request_virtual_card" or "Link MCP create_users_spend_request" — those tools do not exist
- DO NOT paste checkoutUrl for human DIY in agent demonstrations — use `complete_payment` API path
