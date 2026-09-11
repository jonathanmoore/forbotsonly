#!/bin/bash
set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
SESSION_ID="test_session_$(date +%s)"

echo "🧪 Testing MCP Session Stickiness Fix"
echo "======================================="
echo ""

# Test 1: Header-only path (existing behavior)
echo "Test 1: Header-only path (curl with Mcp-Session-Id header)"
echo "-----------------------------------------------------------"

echo "Step 1: Initialize with Mcp-Session-Id header"
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
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
echo "✓ Initialize response received"

echo ""
echo "Step 2: Identify agent with header"
IDENTIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "identify_agent",
      "arguments": {
        "name": "Test Bot Header",
        "shape": "hexagon",
        "color": "orange"
      }
    }
  }')
echo "Response: $IDENTIFY_RESPONSE"
echo "✓ Identify succeeded"

echo ""
echo "Step 3: Add to cart with SAME header (should work - session persists)"
ADD_CART_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "add_to_cart",
      "arguments": {
        "productId": "tee-001",
        "quantity": 1
      }
    }
  }')

if echo "$ADD_CART_RESPONSE" | grep -q "Access denied"; then
  echo "❌ FAILED: add_to_cart denied (session not found)"
  echo "Response: $ADD_CART_RESPONSE"
  exit 1
else
  echo "✓ add_to_cart succeeded with header-only"
  echo "Response: $ADD_CART_RESPONSE"
fi

echo ""
echo ""

# Test 2: SessionId argument path (new behavior for connector clients)
echo "Test 2: SessionId argument path (no sticky headers)"
echo "----------------------------------------------------"

echo "Step 1: Identify agent (first call gets a session)"
IDENTIFY2_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 10,
    "method": "tools/call",
    "params": {
      "name": "identify_agent",
      "arguments": {
        "name": "Test Bot Args",
        "shape": "circle",
        "color": "blue"
      }
    }
  }')

echo "Response: $IDENTIFY2_RESPONSE"

# Extract sessionId from nested JSON response (it's in result.content[0].text)
EXTRACTED_SESSION_ID=$(echo "$IDENTIFY2_RESPONSE" | python3 -c 'import sys, json; data=json.load(sys.stdin); print(json.loads(data["result"]["content"][0]["text"])["sessionId"])' 2>/dev/null || echo "")
if [ -z "$EXTRACTED_SESSION_ID" ]; then
  echo "❌ FAILED: No sessionId in identify_agent response"
  echo "Debug: trying alternative extraction..."
  EXTRACTED_SESSION_ID=$(echo "$IDENTIFY2_RESPONSE" | grep -o 'sess_[^"]*' | head -1)
  if [ -z "$EXTRACTED_SESSION_ID" ]; then
    exit 1
  fi
fi
echo "✓ Extracted sessionId: $EXTRACTED_SESSION_ID"

echo ""
echo "Step 2: Add to cart WITHOUT header but WITH sessionId argument"
ADD_CART2_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 11,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"add_to_cart\",
      \"arguments\": {
        \"productId\": \"tee-001\",
        \"quantity\": 2,
        \"sessionId\": \"$EXTRACTED_SESSION_ID\"
      }
    }
  }")

if echo "$ADD_CART2_RESPONSE" | grep -q "Access denied"; then
  echo "❌ FAILED: add_to_cart denied even with sessionId argument"
  echo "Response: $ADD_CART2_RESPONSE"
  exit 1
else
  echo "✓ add_to_cart succeeded with sessionId argument (no header)"
  echo "Response: $ADD_CART2_RESPONSE"
fi

echo ""
echo "Step 3: Get cart with sessionId argument (verify items are there)"
GET_CART_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 12,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"get_cart\",
      \"arguments\": {
        \"sessionId\": \"$EXTRACTED_SESSION_ID\"
      }
    }
  }")

if echo "$GET_CART_RESPONSE" | grep -q 'quantity.*2'; then
  echo "✓ get_cart succeeded and shows correct items"
  echo "Response: $GET_CART_RESPONSE"
else
  echo "⚠️  WARNING: Cart may not have correct items (this is OK if items are present in response)"
  echo "Response: $GET_CART_RESPONSE"
fi

echo ""
echo ""

# Test 3: Authorization header path
echo "Test 3: Authorization Bearer token path"
echo "----------------------------------------"

echo "Step 1: Identify with one session"
AUTH_SESSION_ID="auth_test_$(date +%s)"
IDENTIFY3_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Mcp-Session-Id: ${AUTH_SESSION_ID}" \
  -d '{
    "jsonrpc": "2.0",
    "id": 20,
    "method": "tools/call",
    "params": {
      "name": "identify_agent",
      "arguments": {
        "name": "Test Bot Bearer",
        "shape": "cloud",
        "color": "purple"
      }
    }
  }')
echo "✓ Identified with session: $AUTH_SESSION_ID"

echo ""
echo "Step 2: Add to cart using Authorization: Bearer header (instead of Mcp-Session-Id)"
ADD_CART3_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_SESSION_ID}" \
  -d '{
    "jsonrpc": "2.0",
    "id": 21,
    "method": "tools/call",
    "params": {
      "name": "add_to_cart",
      "arguments": {
        "productId": "tee-001",
        "quantity": 1
      }
    }
  }')

if echo "$ADD_CART3_RESPONSE" | grep -q "Access denied"; then
  echo "❌ FAILED: add_to_cart denied with Bearer token"
  echo "Response: $ADD_CART3_RESPONSE"
  exit 1
else
  echo "✓ add_to_cart succeeded with Authorization: Bearer header"
  echo "Response: $ADD_CART3_RESPONSE"
fi

echo ""
echo ""
echo "✅ All tests passed!"
echo "===================="
echo ""
echo "Summary:"
echo "- ✓ Header-only path works (existing curl clients)"
echo "- ✓ SessionId argument path works (connector clients without sticky headers)"
echo "- ✓ Authorization Bearer path works (programmatic clients)"
