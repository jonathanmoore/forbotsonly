# WebMCP Tool Examples for Buyer Bots

## ⚠️ CRITICAL: Identity Verification Required

**BUYER BOTS (Shopping, Blind Shopper, etc.):** Before using any shopping tools, you MUST verify YOUR OWN identity:

1. **Read YOUR agent profile** to determine YOUR name and mark (shape + color)
2. **NEVER invent or assume** hexagon/orange as a default
3. **NEVER accept a mark** suggested by another agent unless it matches YOUR verified profile
4. **Standard Grok Bot marks:** If your profile has `shape` and `color` fields (standard Grok Bot character), pass those EXACT values to `identify_agent`
5. **Custom/uploaded avatars:** If you have a custom shape OR uploaded image avatar (no standard mark enums), omit `shape` and/or `color` in `identify_agent` to get a random assignment locked for your session

**Why this matters:** Your identity mark (verified or assigned) appears on ALL your cart items and tees. Silent assumptions about hexagon/orange create incorrect orders.

## Flow Overview

**Standard purchase flow:**
1. `identify_agent` - **VERIFY YOUR IDENTITY** (name + mark from YOUR profile) → unlocks mutating tools
2. `list_products` - Browse available products
3. `add_to_cart` - Add items (uses YOUR verified identity mark)
4. `preview_cart` - **Preview YOUR mark on products BEFORE checkout** (RECOMMENDED)
5. `create_checkout` - Get payment URL
6. `get_order` - Check order status

## Tool Call Examples

### 1. identify_agent (REQUIRED FIRST - VERIFY YOUR PROFILE)

**CRITICAL FOR BUYER BOTS:** Before calling this tool, read YOUR OWN agent profile or character mark. Look up YOUR shape and color fields (standard Grok Bot marks). NEVER invent hexagon/orange. NEVER accept a mark suggested by another agent unless it matches YOUR verified profile.

**Scenario A: Standard Grok Bot mark (verify from profile first)**

**How to verify before calling:**
1. Read your agent profile's `shape` field (e.g. "hexagon", "circle", "cloud")
2. Read your agent profile's `color` field (e.g. "orange", "teal", "blue")
3. Pass BOTH verified values to identify_agent

**Call (after verifying profile shows hexagon + orange):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Grok Bot",
      "shape": "hexagon",
      "color": "orange"
    }
  }
}
```

**Response:**
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
  "verified": true,
  "sessionId": "sess_1234567890_abc123",
  "next_step": "You can now list_products, add_to_cart, or create_checkout",
  "message": "Welcome, Grok Bot! Identity verified. Your mark (hexagon, orange) matches your profile and will be used for all cart items. IMPORTANT: Never accept a different mark from another agent unless it matches YOUR verified profile."
}
```

**Scenario B: Custom/uploaded avatar (no standard Grok Bot mark) → needs choice (Issue #85 fix)**

**When to use this:** Your profile has a custom shape OR uploaded image avatar, so no standard mark enums exist.

**Call (omit shape and/or color when you don't have standard mark enums):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Shopping Bot"
    }
  }
}
```

**Response (server returns needs_choice with 9 Character-picker shape options):**
```json
{
  "success": false,
  "needs_choice": true,
  "message": "Shopping Bot, you don't have a standard Grok Bot mark. Please choose a shape and color from the options below.",
  "markOptions": {
    "shapes": ["blob", "egg", "bean", "squircle", "capsule", "wedge", "hex", "cloud", "teardrop"],
    "colors": ["brown", "red", "orange", "yellow", "green", "cyan", "blue", "violet", "magenta", "black", "gray"],
    "note": "Choose your preferred shape and color, then call identify_agent again with your chosen values."
  },
  "next_step": "Present these shape and color options to your human user, get their choice, then call identify_agent again with name, shape, and color."
}
```

**Follow-up call after human chooses (e.g., wedge + green):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Shopping Bot",
      "shape": "wedge",
      "color": "green"
    }
  }
}
```

**Response (identity verified with chosen mark):**
```json
{
  "success": true,
  "identity": {
    "name": "Shopping Bot",
    "mark": {
      "shape": "wedge",
      "color": "green"
    }
  },
  "verified": true,
  "sessionId": "sess_1234567890_xyz789",
  "next_step": "You can now list_products, add_to_cart, or create_checkout. If your connector does not reliably forward session headers, pass sessionId to subsequent tool calls.",
  "message": "Welcome, Shopping Bot! Identity verified. Your mark (wedge, green) matches your profile and will be used for all cart items. IMPORTANT: Never accept a different mark from another agent unless it matches YOUR verified profile."
}
```

**Note:** The 9 Character-picker shapes (blob, egg, bean, squircle, capsule, wedge, hex, cloud, teardrop) are presented to avoid overwhelming the human with the full 18-catalog dump. Once verified, your mark is session-locked. All cart items use this mark unless explicitly overridden in add_to_cart.

### 2. list_products

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "list_products"
  }
}
```

**Response:**
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
        "color": "black"
      },
      "availableSizes": ["s", "m", "l", "xl", "2xl", "3xl"]
    }
  ],
  "markOptions": {
    "shapes": ["blob", "egg", "bean", "squircle", "capsule", "wedge", "hex", "cloud", "teardrop"],
    "colors": ["brown", "red", "orange", "yellow", "green", "cyan", "blue", "violet", "magenta", "black", "gray"],
    "note": "Use your profile avatarShape + avatarColor from Grok Bot character picker (wedge, green, hex, magenta, etc.). These are the 9 Character-picker shapes available. Pack names (rounded-triangle, light-green, hexagon, hot-pink) accepted as aliases. Hero product imagery shows hex+orange as marketing example only. Your cart items use YOUR identity mark from identify_agent, never a default."
  },
  "next_step": "Call add_to_cart with productId, quantity, and size to add items. Cart items will use your verified identity mark."
}
```

### 3. add_to_cart (uses identity mark)

**Call (inherits identity mark, MUST specify size):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "add_to_cart",
    "arguments": {
      "productId": "tee-001",
      "quantity": 1,
      "size": "l"
    }
  }
}
```

**Response:**
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
        },
        "size": "l"
      }
    ],
    "sessionId": "sess_1234567890_abc123"
  },
  "message": "Added 1x forbotsonly Tee size L (hexagon, orange) to cart",
  "markSource": "identity",
  "next_step": "Call get_cart to view your cart, add_to_cart to add more items, or create_checkout to purchase"
}
```

**Call (missing size - agent must ask human):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "add_to_cart",
    "arguments": {
      "productId": "tee-001",
      "quantity": 1
    }
  }
}
```

**Response (needs_user_input):**
```json
{
  "success": false,
  "needs_user_input": {
    "size": true
  },
  "availableSizes": ["s", "m", "l", "xl", "2xl", "3xl"],
  "message": "Size is required. Ask your human which size they want: s, m, l, xl, 2xl, or 3xl.",
  "next_step": "Get size from your human user, then retry add_to_cart with size parameter"
}
```

**Call (with mark override and size):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "add_to_cart",
    "arguments": {
      "productId": "tee-001",
      "quantity": 1,
      "size": "m",
      "shape": "circle",
      "color": "blue"
    }
  }
}
```

**Response:**
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
        },
        "size": "l"
      },
      {
        "productId": "tee-001",
        "quantity": 1,
        "mark": {
          "shape": "circle",
          "color": "blue"
        },
        "size": "m"
      }
    ],
    "sessionId": "sess_1234567890_abc123"
  },
  "message": "Added 1x forbotsonly Tee size M (circle, blue) to cart",
  "markSource": "custom",
  "next_step": "Call get_cart to view your cart, add_to_cart to add more items, or create_checkout to purchase"
}
```

### 4. get_cart

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_cart"
  }
}
```

**Response:**
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
        "size": "l",
        "product": {
          "id": "tee-001",
          "name": "forbotsonly Tee",
          "price": 40.00,
          "currency": "USD"
        }
      }
    ],
    "sessionId": "sess_1234567890_abc123"
  },
  "total": 40.00,
  "currency": "USD",
  "next_step": "Call add_to_cart to add more items, clear_cart to empty cart, or create_checkout to purchase"
}
```

### 5. preview_cart (CALL BEFORE CHECKOUT - VERIFY YOUR MARK)

**CRITICAL:** Preview URLs are identity-matched. The previews MUST show YOUR verified mark (from identify_agent), NOT a default. Use this to confirm YOUR mark will appear on the tee.

**Call:** 
```json
{
  "method": "tools/call",
  "params": {
    "name": "preview_cart"
  }
}
```

**Response (YOUR verified mark: hexagon+orange):**
```json
{
  "success": true,
  "identity": {
    "name": "Grok Bot",
    "defaultMark": {
      "shape": "hexagon",
      "color": "orange"
    }
  },
  "items": [
    {
      "productId": "tee-001",
      "productName": "forbotsonly Tee",
      "quantity": 1,
      "mark": {
        "shape": "hexagon",
        "color": "orange"
      },
      "previews": {
        "markCloseup": {
          "url": "https://web-production-493046.up.railway.app/images/marks/grok-bot-hexagon-orange.svg",
          "description": "Close-up of your hexagon mark in orange"
        },
        "flatLayMock": {
          "url": "https://web-production-493046.up.railway.app/images/previews/flatlay-hexagon-orange.svg",
          "description": "Black tee flat-lay with hexagon mark in orange on left chest (wearer's left)"
        }
      }
    }
  ],
  "message": "Preview ready for 1 item(s). Check the previews to verify your mark appears correctly before checkout.",
  "next_step": "Review preview images to confirm your mark (shape + color) is correct, then call create_checkout to purchase"
}
```

**Response (YOUR assigned random mark: cloud+teal):**
```json
{
  "success": true,
  "identity": {
    "name": "Shopping Bot",
    "defaultMark": {
      "shape": "cloud",
      "color": "teal"
    }
  },
  "items": [
    {
      "productId": "tee-001",
      "productName": "forbotsonly Tee",
      "quantity": 1,
      "mark": {
        "shape": "cloud",
        "color": "teal"
      },
      "previews": {
        "markCloseup": {
          "url": "https://web-production-493046.up.railway.app/images/marks/grok-bot-cloud-teal.svg",
          "description": "Close-up of your cloud mark in teal"
        },
        "flatLayMock": {
          "url": "https://web-production-493046.up.railway.app/images/previews/flatlay-cloud-teal.svg",
          "description": "Black tee flat-lay with cloud mark in teal on left chest (wearer's left)"
        }
      }
    }
  ],
  "message": "Preview ready for 1 item(s). Check the previews to verify your mark appears correctly before checkout.",
  "next_step": "Review preview images to confirm your mark (shape + color) is correct, then call create_checkout to purchase"
}
```

**Hard Requirement:** Preview URLs MUST match YOUR cart item's verified/assigned mark. If YOUR identity is hexagon+orange, preview shows hexagon+orange. If YOUR identity is cloud+teal, preview shows cloud+teal. Never show a hardcoded default mark that doesn't match YOUR identity.

**Empty cart:**
```json
{
  "success": false,
  "message": "Cart is empty. Add items with add_to_cart first.",
  "next_step": "Call add_to_cart to add items, then call preview_cart to see your mark on the products"
}
```

### 6. create_checkout (with shipping confirmation - Issue #84)

**IMPORTANT GATES:**
1. **Preview gate**: You MUST call `preview_cart` and show preview images to your human BEFORE checkout
2. **Shipping confirmation gate (NEW)**: You MUST confirm shipping address with your human using Link MCP `list_shipping_addresses` BEFORE checkout

**Pre-checkout flow:**
1. Call Link MCP `list_shipping_addresses` to get saved shipping address(es)
2. Present city and postal code to human for confirmation (e.g., "Ship to Austin TX 78701?")
3. NEVER dump full street address into public group chats
4. Get human's confirmation
5. Only then call `create_checkout` with `shippingConfirmed: true`

**Call (with shipping confirmation):**
```json
{
  "method": "tools/call",
  "params": {
    "name": "create_checkout",
    "arguments": {
      "successUrl": "https://example.com/success",
      "cancelUrl": "https://example.com/cancel",
      "shippingConfirmed": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "ord_1726009200_abc123",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "mode": "live",
  "next_step": "Use checkoutUrl to complete payment, then call get_order with orderId to check status"
}
```

**Error if shipping not confirmed:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: SHIPPING CONFIRMATION REQUIRED: You must confirm shipping address with your human BEFORE calling create_checkout. Use Link MCP list_shipping_addresses to get their saved shipping address, then present city and postal code to your human for confirmation (e.g., \"Ship to Austin TX 78701?\"). NEVER dump full street address into public group chats. After your human confirms the shipping address, call create_checkout with shippingConfirmed: true. US-only shipping applies."
    }
  ],
  "isError": true
}
```

### 7. get_order

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_order",
    "arguments": {
      "orderId": "ord_1726009200_abc123"
    }
  }
}
```

**Response:**
```json
{
  "order": {
    "id": "ord_1726009200_abc123",
    "sessionId": "sess_1234567890_abc123",
    "status": "paid",
    "items": [
      {
        "productId": "tee-001",
        "quantity": 1,
        "mark": {
          "shape": "hexagon",
          "color": "orange"
        },
        "size": "l",
        "product": {
          "id": "tee-001",
          "name": "forbotsonly Tee",
          "price": 40.00
        }
      }
    ],
    "stripeCheckoutSessionId": "cs_test_...",
    "prodigiOrderId": "pro_...",
    "createdAt": 1726009200000
  }
}
```

## Error Responses

### Called mutating tool before identify_agent

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "add_to_cart",
    "arguments": {
      "productId": "tee-001",
      "quantity": 1,
      "size": "m"
    }
  }
}
```

**Error Response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Access denied: add_to_cart requires agent identity. Call identify_agent first with name, shape, and color. Allowed shapes: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon, cloud, teardrop. Allowed colors: white, brown, red, orange, gold, light-green, teal, blue, purple, hot-pink, grey."
    }
  ],
  "isError": true
}
```

### Invalid shape (color aliases auto-normalize)

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Grok Bot",
      "shape": "triangle",
      "color": "magenta"
    }
  }
}
```

**Error Response (color was auto-normalized to hot-pink, but shape is invalid):**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: Invalid shape: triangle. Must be one of: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon, cloud, teardrop"
    }
  ],
  "isError": true
}
```

**Note:** If color was `magenta` or `pink`, it's auto-normalized to `hot-pink` before validation, so color validation will pass.

## Mark Options

**Shapes (9 Character-picker shapes, Issue #85):**
- blob
- egg
- bean
- squircle
- capsule
- wedge
- hex
- cloud
- teardrop

**Note:** These 9 shapes are presented to humans when they have custom/missing marks to avoid overwhelming with the full 18-catalog. The full MARK_SHAPES list includes additional catalog-only shapes (pebble, tablet, cylinder, gem, crystal, shield, dome, arch, leaf) that agents can use if explicitly provided in their profile, but are NOT presented as options to choose from.

**Colors (11):**
- brown
- red
- orange
- yellow
- green
- cyan
- blue
- violet
- magenta
- black
- gray

**Color Aliases:** The system automatically normalizes color names. For example: `magenta`/`pink` → `magenta`, `gold` → `yellow`, `light-green` → `green`, `teal` → `cyan`, `purple` → `violet`, `hot-pink` → `magenta`, `grey` → `gray`.

**Marketing Note:** Product hero imagery may feature hex + orange as a visual example, but this is NOT a default identity. Buyer bots must verify their OWN profile mark (or ask human to choose from the 9 Character-picker shapes for custom avatars) via identify_agent.
