# QA Guide: Testing MCP Session Stickiness via Connector

## Overview

This guide helps you test the session stickiness fix (#19) using the `forbotsonly` MCP connector from Cursor or other MCP hosts.

## Prerequisites

1. MCP server running (locally or deployed)
2. MCP connector configured in Cursor
3. Access to the `forbotsonly` MCP tools

## Test Scenario 1: Basic Identity + Cart Flow

### Expected: Session persists across multiple tool calls

```
1. Call identify_agent
   - name: "QA Tester"
   - shape: "hexagon"
   - color: "orange"
   - SAVE the returned sessionId from the response

2. Call add_to_cart
   - productId: "tee-001"
   - quantity: 1
   - sessionId: <the sessionId from step 1>
   - Expected: Success (NOT "Access denied")

3. Call get_cart
   - sessionId: <the sessionId from step 1>
   - Expected: Shows 1 item in cart

4. Call add_to_cart again
   - productId: "tee-001"
   - quantity: 2
   - sessionId: <the sessionId from step 1>
   - Expected: Success, cart now has 3 total

5. Call create_checkout
   - successUrl: "https://example.com/success"
   - cancelUrl: "https://example.com/cancel"
   - sessionId: <the sessionId from step 1>
   - Expected: Returns checkout URL (stub or live depending on Stripe config)
```

## Test Scenario 2: Without sessionId Parameter (May Fail)

### Expected: Demonstrates the problem this fix addresses

```
1. Call identify_agent
   - name: "QA Tester 2"
   - shape: "circle"
   - color: "blue"
   - DO NOT save the sessionId

2. Call add_to_cart WITHOUT sessionId parameter
   - productId: "tee-001"
   - quantity: 1
   - If your connector doesn't forward headers: Access denied ❌
   - If your connector DOES forward headers: Success ✅
```

This scenario demonstrates that **without passing sessionId explicitly**, behavior depends on whether the connector host reliably forwards session headers.

## Test Scenario 3: Multiple Sessions

### Expected: Each session maintains its own cart

```
1. Identify as "Bot A" (shape: hexagon, color: orange)
   - Save sessionIdA

2. Add 1x tee-001 to cart using sessionIdA

3. Identify as "Bot B" (shape: circle, color: blue)
   - Save sessionIdB

4. Add 2x tee-001 to cart using sessionIdB

5. Get cart with sessionIdA
   - Expected: Shows 1 item (Bot A's cart)

6. Get cart with sessionIdB
   - Expected: Shows 2 items (Bot B's cart)
```

## Known Working Patterns

### ✅ Always Works
- Passing `sessionId` explicitly to every tool that supports it
- Using `Authorization: Bearer <sessionId>` header (if supported by your connector)

### ⚠️ Depends on Connector
- Relying on `Mcp-Session-Id` header propagation
- Relying on cookie propagation

## Troubleshooting

### "Access denied" on add_to_cart
**Symptom**: `identify_agent` succeeds but `add_to_cart` returns "Access denied: add_to_cart requires agent identity"

**Solution**: Make sure you're passing the `sessionId` parameter:
```javascript
{
  productId: "tee-001",
  quantity: 1,
  sessionId: "<the session ID from identify_agent>"
}
```

### Can't find sessionId in identify_agent response
**Check**: The `sessionId` field is at the top level of the result object:
```json
{
  "success": true,
  "identity": {...},
  "sessionId": "sess_1234567890_abc123",  ← here
  "next_step": "...",
  "message": "..."
}
```

### Cart is empty after adding items
**Check**: Are you passing the **same** `sessionId` to all calls? Each unique session ID gets its own cart.

## Direct HTTP Testing (for comparison)

If you want to test the HTTP API directly (bypassing the connector):

```bash
# Run the test suite
./test-session-stickiness.sh

# Or manual curl commands:
SESSION_ID="test_$(date +%s)"

# Initialize
curl -X POST http://localhost:3001/mcp \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# Identify
curl -X POST http://localhost:3001/mcp \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"identify_agent","arguments":{"name":"Test","shape":"hexagon","color":"orange"}}}'

# Add to cart
curl -X POST http://localhost:3001/mcp \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add_to_cart","arguments":{"productId":"tee-001","quantity":1}}}'
```

## Success Criteria

- ✅ `identify_agent` returns a `sessionId`
- ✅ `add_to_cart` with `sessionId` parameter succeeds (no "Access denied")
- ✅ `get_cart` with same `sessionId` shows the correct items
- ✅ Multiple sessions can coexist with separate carts
- ✅ All existing buyer flows work: identify → list/get → cart → create_checkout → get_order
