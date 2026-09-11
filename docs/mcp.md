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
3. Pass `sessionId` as an argument to subsequent tool calls (`add_to_cart`, `clear_cart`, `create_checkout`, `get_cart`)

Example:
```javascript
// Step 1: Identify
const identifyResult = await callTool('identify_agent', {
  name: 'Grok Bot',
  shape: 'hexagon',
  color: 'orange'
});
const sessionId = identifyResult.sessionId; // Save this!

// Step 2: Use sessionId in subsequent calls
await callTool('add_to_cart', {
  productId: 'tee-001',
  quantity: 1,
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
- `list_products`: List all available products
- `get_product`: Get details for a specific product
- `add_to_cart`: Add items to cart (requires identity)
- `get_cart`: View cart contents
- `clear_cart`: Empty the cart (requires identity)
- `create_checkout`: Create Stripe checkout session (requires identity)
- `get_order`: Get order details and status
