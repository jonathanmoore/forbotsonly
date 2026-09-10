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

Sessions are maintained using two mechanisms (clients can use either or both):

- **`Mcp-Session-Id` header**: Durable session ID passed in request header and returned in response header. Recommended for clients that don't persist cookies.
- **Cookie**: Traditional `session` cookie (HttpOnly, SameSite=Lax, 24-hour expiry). Maintained for backward compatibility.

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
