# WebMCP Tool Examples for Buyer Bots

## Flow Overview

**Standard purchase flow:**
1. `identify_agent` - Identify with name + mark → unlocks mutating tools
2. `list_products` - Browse available products
3. `add_to_cart` - Add items (uses your identity mark)
4. `preview_cart` - **Preview your mark on products BEFORE checkout** (RECOMMENDED)
5. `create_checkout` - Get payment URL
6. `get_order` - Check order status

## Tool Call Examples

### 1. identify_agent (REQUIRED FIRST)

**Scenario A: Agent has shape + color (standard)**

**Call:**
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
  "next_step": "You can now list_products, add_to_cart, or create_checkout",
  "message": "Welcome, Grok Bot! You have full access to mutating tools. Your identity mark (hexagon, orange) will be used for cart items."
}
```

**Scenario B: Agent missing shape/color (e.g. custom/uploaded image avatar)**

**Call:**
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

**Response:**
```json
{
  "success": false,
  "needs_user_input": {
    "shape": true,
    "color": true
  },
  "enums": {
    "shapes": ["circle", "vertical-oval", "rounded-square", "horizontal-pill", "rounded-triangle", "hexagon", "cloud", "teardrop"],
    "colors": ["white", "brown", "red", "orange", "gold", "light-green", "teal", "blue", "purple", "hot-pink", "grey"]
  },
  "message": "Ask your human which shape and color to print. Once you have them, call identify_agent again with name, shape, and color.",
  "next_step": "Get shape and color from your human user, then retry identify_agent with all three parameters"
}
```

**Then retry with human's choice:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Shopping Bot",
      "shape": "cloud",
      "color": "teal"
    }
  }
}
```

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
    "shapes": ["circle", "vertical-oval", "rounded-square", "horizontal-pill", "rounded-triangle", "hexagon", "cloud", "teardrop"],
    "colors": ["white", "brown", "red", "orange", "gold", "light-green", "teal", "blue", "purple", "hot-pink", "grey"],
    "default": {
      "shape": "hexagon",
      "color": "orange"
    }
  },
  "next_step": "Call add_to_cart with productId, quantity, and size to add items"
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

### 5. preview_cart (CALL BEFORE CHECKOUT)

**Call:** 
```json
{
  "method": "tools/call",
  "params": {
    "name": "preview_cart"
  }
}
```

**Response (with hexagon+orange mark):**
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

**Response (with cloud+teal mark override):**
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

**Hard Requirement:** Preview URLs MUST match the cart item's mark. If cart has hexagon+orange, preview shows hexagon+orange. If cart has cloud+teal, preview shows cloud+teal. Never show a hardcoded default mark.

**Empty cart:**
```json
{
  "success": false,
  "message": "Cart is empty. Add items with add_to_cart first.",
  "next_step": "Call add_to_cart to add items, then call preview_cart to see your mark on the products"
}
```

### 6. create_checkout

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "create_checkout",
    "arguments": {
      "successUrl": "https://example.com/success",
      "cancelUrl": "https://example.com/cancel"
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

### Invalid shape/color

**Call:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "identify_agent",
    "arguments": {
      "name": "Grok Bot",
      "shape": "triangle",
      "color": "pink"
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
      "text": "Error: Invalid shape: triangle. Must be one of: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon, cloud, teardrop"
    }
  ],
  "isError": true
}
```

## Mark Options

**Shapes (8):**
- circle
- vertical-oval
- rounded-square
- horizontal-pill
- rounded-triangle
- hexagon ⭐ (hero/default)
- cloud (3-lobe)
- teardrop

**Colors (11):**
- white
- brown
- red
- orange ⭐ (hero/default)
- gold
- light-green
- teal
- blue
- purple
- hot-pink
- grey

**Default/Hero Mark:** hexagon + orange
