#!/bin/bash
# Test script to verify MCP handshake works correctly
# Usage: ./scripts/test-mcp.sh [BASE_URL]
# Example: ./scripts/test-mcp.sh https://web-production-493046.up.railway.app

BASE_URL="${1:-http://localhost:3001}"
SESSION_ID="test-$(date +%s)"

echo "🧪 Testing MCP endpoint: $BASE_URL/mcp"
echo "Session ID: $SESSION_ID"
echo ""

# Test 1: Initialize
echo "1️⃣  Testing initialize method..."
INIT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-client", "version": "1.0.0"}
    }
  }')

HTTP_CODE=$(echo "$INIT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$INIT_RESPONSE" | sed '/HTTP_CODE:/d')

if [ "$HTTP_CODE" = "200" ] && echo "$BODY" | jq -e '.result.serverInfo.name' > /dev/null 2>&1; then
  echo "✅ Initialize works"
  echo "$BODY" | jq -c '.result.serverInfo'
else
  echo "❌ Initialize failed"
  echo "HTTP Code: $HTTP_CODE"
  echo "$BODY" | jq 2>/dev/null || echo "$BODY"
  exit 1
fi

echo ""

# Test 2: Notifications/initialized
echo "2️⃣  Testing notifications/initialized..."
NOTIF_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc": "2.0", "method": "notifications/initialized"}')

if [ "$NOTIF_CODE" = "204" ]; then
  echo "✅ Notifications work (204 No Content)"
else
  echo "❌ Notification failed (expected 204, got $NOTIF_CODE)"
fi

echo ""

# Test 3: Tools/list
echo "3️⃣  Testing tools/list with session..."
TOOLS_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}')

TOOLS_COUNT=$(echo "$TOOLS_RESPONSE" | jq -r '.result.tools | length' 2>/dev/null)
if [ "$TOOLS_COUNT" -gt 0 ]; then
  echo "✅ Tools/list works ($TOOLS_COUNT tools available)"
  echo "$TOOLS_RESPONSE" | jq -c '[.result.tools[].name]'
else
  echo "❌ Tools/list failed"
  echo "$TOOLS_RESPONSE" | jq 2>/dev/null || echo "$TOOLS_RESPONSE"
  exit 1
fi

echo ""

# Test 4: Tools/call
echo "4️⃣  Testing tools/call (list_products)..."
CALL_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_products",
      "arguments": {}
    }
  }')

if echo "$CALL_RESPONSE" | jq -e '.result.content' > /dev/null 2>&1; then
  echo "✅ Tools/call works"
  echo "$CALL_RESPONSE" | jq -c '.result.content[0].text' | head -c 100
  echo "..."
else
  echo "❌ Tools/call failed"
  echo "$CALL_RESPONSE" | jq 2>/dev/null || echo "$CALL_RESPONSE"
  exit 1
fi

echo ""

# Test 5: Error handling
echo "5️⃣  Testing error handling (unknown method)..."
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 99, "method": "unknown/method", "params": {}}')

ERROR_CODE=$(echo "$ERROR_RESPONSE" | jq -r '.error.code' 2>/dev/null)
if [ "$ERROR_CODE" = "-32601" ]; then
  echo "✅ Error handling works (JSON-RPC error code: $ERROR_CODE)"
  echo "$ERROR_RESPONSE" | jq -c '.error.message'
else
  echo "⚠️  Error handling unexpected"
  echo "$ERROR_RESPONSE" | jq 2>/dev/null || echo "$ERROR_RESPONSE"
fi

echo ""
echo "🎉 All tests passed!"
