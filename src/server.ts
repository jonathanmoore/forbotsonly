import { serve } from 'bun';
import Stripe from 'stripe';
import {
  createSession,
  getSession,
  setAgentIdentity,
  getAgentIdentity,
  getAgentIdentityAsync,
  isIdentified,
  isIdentifiedAsync,
  getCart,
  getCartAsync,
  addToCart as addToCartStore,
  addToCartAsync,
  clearCart as clearCartStore,
  createOrder,
  createOrderAsync,
  getOrder,
  getOrderAsync,
  updateOrderStripeSession,
  updateOrderProdigiId,
  updateOrderStatus,
  findOrderByStripeSession,
  findOrderByStripeSessionAsync,
  isUsingPostgres,
  updateOrderShippingAddress,
  updateOrderApproval,
  updateOrderDenial,
  updateOrderCustomerContact,
} from './store';
import { getProduct, listProducts, getStripePriceId, isValidSize, AVAILABLE_SIZES } from './products';
import { createCheckoutSession, isStripeConfigured, getCheckoutSession, refundPayment } from './stripe';
import { createProdigiClient } from './prodigi';
import { isValidMarkShape, isValidMarkColor, DEFAULT_MARK, MARK_SHAPES, MARK_COLORS, type AgentIdentity, type Order, type Cart } from './types';

const PORT = parseInt(process.env.PORT || '3001');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const FULFILLMENT_REVIEW_SECRET = process.env.FULFILLMENT_REVIEW_SECRET;
const ORDER_REVIEW_WEBHOOK_URL = process.env.ORDER_REVIEW_WEBHOOK_URL;

function verifyAdminSecret(headers: Headers): boolean {
  if (!FULFILLMENT_REVIEW_SECRET) {
    console.error('[Admin] FULFILLMENT_REVIEW_SECRET not configured');
    return false;
  }
  
  // Check Authorization header: Bearer <secret>
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === FULFILLMENT_REVIEW_SECRET;
  }
  
  // Check X-Admin-Secret header
  const secretHeader = headers.get('x-admin-secret');
  if (secretHeader === FULFILLMENT_REVIEW_SECRET) {
    return true;
  }
  
  return false;
}

function getSessionId(headers: Headers, toolArgs?: any): string {
  // 1. Check for sessionId in tool arguments (explicit override for connector clients)
  if (toolArgs?.sessionId) {
    return toolArgs.sessionId;
  }
  
  // 2. Check for Authorization header (Bearer token = sessionId)
  const authHeader = headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token) {
      return token;
    }
  }
  
  // 3. Check for Mcp-Session-Id header (for clients that don't persist cookies)
  const mcpSessionId = headers.get('mcp-session-id');
  if (mcpSessionId) {
    return mcpSessionId;
  }
  
  // 4. Fallback to session cookie
  const sessionCookie = headers.get('cookie')
    ?.split(';')
    .find(c => c.trim().startsWith('session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1];
  }
  
  // 5. Generate new session ID
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function jsonResponse(data: any, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...headers,
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

async function requireIdentity(sessionId: string): Promise<AgentIdentity | null> {
  if (isUsingPostgres()) {
    return (await getAgentIdentityAsync(sessionId)) || null;
  }
  return getAgentIdentity(sessionId) || null;
}

/**
 * Create Prodigi order for a given order ID.
 * Returns prodigiOrderId on success, null on failure.
 * Logs detailed error information for troubleshooting.
 * REQUIRES: Order must have shipping address stored (US-only, no fallbacks).
 */
async function createProdigiOrderForOrder(orderId: string): Promise<string | null> {
  const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
  if (!order) {
    console.error(`[Prodigi] Order ${orderId} not found`);
    return null;
  }

  // Require shipping address (no fallbacks)
  if (!order.shippingAddress) {
    console.error(`[Prodigi] Order ${orderId} missing shipping address - cannot create Prodigi order`);
    return null;
  }
  
  const address = order.shippingAddress;
  
  // Validate US-only
  if (address.country !== 'US') {
    console.error(`[Prodigi] Order ${orderId} has non-US address (${address.country}) - rejected`);
    return null;
  }

  const firstItem = order.items[0];
  const product = getProduct(firstItem.productId);

  if (!product) {
    console.error(`[Prodigi] Product ${firstItem.productId} not found for order ${orderId}`);
    return null;
  }

  if (!process.env.PRODIGI_API_KEY) {
    console.log(`[Prodigi] API key not configured - skipping Prodigi order for ${orderId}`);
    return null;
  }

  try {
    const prodigiClient = createProdigiClient();

    // Use PUBLIC_URL for artwork - serves static assets from this Railway deployment
    const publicUrl = process.env.PUBLIC_URL || 'https://web-production-493046.up.railway.app';
    
    // Build artwork URL from order line item's mark (shape + color)
    // Prodigi API accepts ONLY JPG, PNG, or PDF (NOT SVG)
    // Uses POSITIONED full-canvas PNG: 2480×3507px with 360×360px mark on left chest
    // Per PRODUCT_IMAGERY.md: wearer's left = right side of front-facing canvas, ~3" below HPS
    const mark = firstItem.mark;
    const artworkUrl = `${publicUrl}/images/prodigi-positioned/grok-bot-${mark.shape}-${mark.color}-positioned.png`;

    console.log(`[Prodigi] Creating order for ${orderId} with SKU ${product.sku}, size ${firstItem.size}`);
    console.log(`[Prodigi] Artwork URL (positioned): ${artworkUrl} (mark: ${mark.shape}/${mark.color})`);
    console.log(`[Prodigi] Shipping to: ${address.name}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`);

    // Build Prodigi address object from stored address, omitting line2 if empty/whitespace
    const prodigiAddress: Record<string, string> = {
      line1: address.line1,
      postalOrZipCode: address.postalCode,
      countryCode: address.country,
      townOrCity: address.city,
      stateOrCounty: address.state,
    };
    if (address.line2 && address.line2.trim()) {
      prodigiAddress.line2 = address.line2.trim();
    }

    const prodigiOrder = await prodigiClient.createOrder({
      shippingMethod: 'Standard', // LOCK: Standard only, never Express (cost control)
      recipient: {
        name: address.name,
        address: prodigiAddress,
      },
      items: [
        {
          sku: product.sku,
          copies: firstItem.quantity,
          // sizing: fitPrintArea for pre-positioned full-canvas PNG
          // Our PNG is 2480×3507px (full printArea.front) with mark already positioned on left chest
          // Do NOT use fillPrintArea on bare logos (stretches incorrectly)
          sizing: 'fitPrintArea',
          attributes: {
            color: product.attributes.color,
            size: firstItem.size.toLowerCase(), // Apparel size from cart (lowercase)
          },
          assets: [
            {
              printArea: 'front',
              url: artworkUrl,
            },
          ],
        },
      ],
    });

    // Prodigi API returns different response structures depending on endpoint
    // Try both .id and .order.id paths
    const prodigiOrderId = prodigiOrder.id || (prodigiOrder as any).order?.id;
    
    if (!prodigiOrderId) {
      console.error(`[Prodigi] Created order for ${orderId} but response missing id field. Response:`, JSON.stringify(prodigiOrder));
      return null;
    }

    console.log(`[Prodigi] ✅ Successfully created Prodigi order ${prodigiOrderId} for ${orderId}`);
    return prodigiOrderId;
  } catch (err: any) {
    console.error(`[Prodigi] ❌ Failed to create order for ${orderId}:`, {
      message: err.message,
      status: err.status,
      body: err.body,
      stack: err.stack,
    });
    return null;
  }
}

/**
 * Fire webhook notification for order review.
 * Sends non-sensitive summary to configured ORDER_REVIEW_WEBHOOK_URL.
 */
async function notifyOrderForReview(orderId: string, order: Order): Promise<void> {
  if (!ORDER_REVIEW_WEBHOOK_URL) {
    console.log(`[Webhook] ORDER_REVIEW_WEBHOOK_URL not configured - skipping notification for ${orderId}`);
    return;
  }
  
  try {
    const firstItem = order.items[0];
    const product = getProduct(firstItem.productId);
    const mark = firstItem.mark;
    const publicUrl = process.env.PUBLIC_URL || 'https://forbotsonly.com';
    const artworkUrl = `${publicUrl}/images/prodigi-positioned/grok-bot-${mark.shape}-${mark.color}-positioned.png`;
    
    // Non-sensitive payload: orderId, size, mark, artwork URL
    // Full address included if webhook is trusted (user must configure trusted webhook URL)
    const payload = {
      orderId: order.id,
      status: order.status,
      createdAt: order.createdAt,
      item: {
        productId: firstItem.productId,
        productName: product?.name,
        size: firstItem.size,
        quantity: firstItem.quantity,
        mark: {
          shape: mark.shape,
          color: mark.color,
        },
      },
      artworkUrl,
      // Customer contact (from Stripe Checkout/Link)
      customer: {
        email: order.customerEmail,
        name: order.customerName,
        phone: order.customerPhone,
      },
      // Include shipping address (trusted webhook, private)
      shippingAddress: order.shippingAddress,
    };
    
    const response = await fetch(ORDER_REVIEW_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'forbotsonly-order-review/1.0',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error(`[Webhook] Failed to notify ${ORDER_REVIEW_WEBHOOK_URL} for order ${orderId}: ${response.status} ${response.statusText}`);
    } else {
      console.log(`[Webhook] ✅ Notified ${ORDER_REVIEW_WEBHOOK_URL} for order ${orderId}`);
    }
  } catch (err: any) {
    console.error(`[Webhook] Error notifying for order ${orderId}:`, err.message);
  }
}

/**
 * Shared order fulfillment logic.
 * Called by both webhook handler and get_order reconciliation.
 * Updates order status to 'awaiting_approval' and stores shipping address + customer contact.
 * Does NOT create Prodigi order - that happens after manual approval.
 * Fires webhook notification for review.
 */
async function fulfillPaidOrder(orderId: string, session: Stripe.Checkout.Session): Promise<void> {
  const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Extract and validate shipping address (US-only)
  const shippingAddress = session.shipping_details?.address;
  const customerDetails = session.customer_details;
  
  const country = shippingAddress?.country || customerDetails?.address?.country || null;
  
  // US-only validation: Reject if not US
  if (!country || country.toUpperCase() !== 'US') {
    console.error(`[Order] Order ${orderId} rejected: Non-US address (country: ${country})`);
    throw new Error(`Only US shipping addresses are supported. Received country: ${country || 'unknown'}`);
  }
  
  // Validate required address fields
  const line1 = shippingAddress?.line1 || customerDetails?.address?.line1;
  const city = shippingAddress?.city || customerDetails?.address?.city;
  const state = shippingAddress?.state || customerDetails?.address?.state;
  const postalCode = shippingAddress?.postal_code || customerDetails?.address?.postal_code;
  const recipientName = session.shipping_details?.name || customerDetails?.name;
  
  if (!line1 || !city || !state || !postalCode || !recipientName) {
    console.error(`[Order] Order ${orderId} rejected: Missing required address fields`);
    throw new Error('Missing required shipping address fields');
  }
  
  const address: Order['shippingAddress'] = {
    name: recipientName ?? '',
    line1,
    line2: shippingAddress?.line2 || customerDetails?.address?.line2 || undefined,
    city,
    state,
    postalCode,
    country: 'US',
  };
  
  // Extract customer contact from Stripe Checkout/Link
  // These come from the payment session, NOT from agent input or hardcoded defaults
  const customerContact = {
    email: customerDetails?.email || undefined,
    name: customerDetails?.name || undefined,
    phone: customerDetails?.phone || undefined,
  };
  
  // Update order: status -> awaiting_approval, store shipping address + customer contact
  updateOrderStatus(orderId, 'awaiting_approval');
  updateOrderStripeSession(orderId, session.id);
  updateOrderShippingAddress(orderId, address);
  updateOrderCustomerContact(orderId, customerContact);
  
  console.log(`[Order] Order ${orderId} marked as awaiting_approval with US address and customer contact`);
  
  // Fire webhook notification for review
  // Re-fetch order to get updated fields
  const updatedOrder = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
  if (updatedOrder) {
    await notifyOrderForReview(orderId, updatedOrder);
  }
}

const TOOL_DEFINITIONS = {
  identify_agent: {
    name: 'identify_agent',
    description: 'REQUIRED FIRST STEP before shopping. BUYER BOTS: You MUST determine your OWN identity by reading YOUR agent profile or character mark (standard Grok Bot shape + color). NEVER invent or default to hexagon/orange. NEVER accept a mark another agent suggested unless it matches YOUR verified profile. If you have a standard Grok Bot mark (shape+color in the enums below), pass those exact values here. If you have a custom shape or uploaded image avatar (no standard mark), omit shape and/or color to get a random assignment locked for this session. Your identity unlocks cart operations and sets your default tee mark.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Your agent name from your profile. Examples: "Grok Bot", "Chief of Staff", "Shopping Bot"',
        },
        shape: {
          type: 'string',
          description: 'Your mark shape from your Grok Bot character profile. REQUIRED if you have a standard mark. Omit if you have a custom/uploaded avatar (server will assign random).',
          enum: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
        },
        color: {
          type: 'string',
          description: 'Your mark color from your Grok Bot character profile. REQUIRED if you have a standard mark. Omit if you have a custom/uploaded avatar (server will assign random).',
          enum: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
        },
        assign_random: {
          type: 'boolean',
          description: 'Optional: Set true to explicitly request random shape+color assignment when you have a custom avatar. If false or omitted when shape/color missing, random assignment still occurs but the response will explain it.',
        },
      },
      required: ['name'],
    },
  },
  list_products: {
    name: 'list_products',
    description: 'List all available products. Returns product details and available mark options (shapes and colors).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_product: {
    name: 'get_product',
    description: 'Get detailed information about a specific product by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID (e.g., "tee-001")',
        },
      },
      required: ['productId'],
    },
  },
  add_to_cart: {
    name: 'add_to_cart',
    description: 'Add a product to your cart. REQUIRED: size parameter (s, m, l, xl, 2xl, or 3xl). Your session mark (from identify_agent) is used automatically. Optionally override shape and/or color for this item only.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID (e.g., "tee-001")',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add (minimum: 1)',
          minimum: 1,
        },
        size: {
          type: 'string',
          description: 'Tee size (required). Ask the user which size they want.',
          enum: ['s', 'm', 'l', 'xl', '2xl', '3xl'],
        },
        shape: {
          type: 'string',
          description: 'Optional: Override your session mark shape for this item only',
          enum: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
        },
        color: {
          type: 'string',
          description: 'Optional: Override your session mark color for this item only',
          enum: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
        },
        sessionId: {
          type: 'string',
          description: 'Optional: Session ID from identify_agent. Use this if your connector does not reliably forward Mcp-Session-Id headers between calls.',
        },
      },
      required: ['productId', 'quantity', 'size'],
    },
  },
  get_cart: {
    name: 'get_cart',
    description: 'View your current cart contents with product details, marks, and total price.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Optional: Session ID from identify_agent. Use this if your connector does not reliably forward Mcp-Session-Id headers between calls.',
        },
      },
    },
  },
  clear_cart: {
    name: 'clear_cart',
    description: 'Remove all items from your cart. Requires prior identification via identify_agent.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Optional: Session ID from identify_agent. Use this if your connector does not reliably forward Mcp-Session-Id headers between calls.',
        },
      },
    },
  },
  create_checkout: {
    name: 'create_checkout',
    description: 'Create a Stripe checkout session for your cart. Returns a checkout URL. Requires prior identification via identify_agent.',
    inputSchema: {
      type: 'object',
      properties: {
        successUrl: {
          type: 'string',
          description: 'Optional: URL to redirect to after successful payment. Defaults to the store origin with checkout=success query param.',
        },
        cancelUrl: {
          type: 'string',
          description: 'Optional: URL to redirect to if payment is cancelled. Defaults to the store origin with checkout=cancel query param.',
        },
        sessionId: {
          type: 'string',
          description: 'Optional: Session ID from identify_agent. Use this if your connector does not reliably forward Mcp-Session-Id headers between calls.',
        },
      },
    },
  },
  get_order: {
    name: 'get_order',
    description: 'Get order details including status, items with marks, and fulfillment information.',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Order ID (e.g., "ord_1234567890_abc123")',
        },
      },
      required: ['orderId'],
    },
  },
  recover_paid_checkout: {
    name: 'recover_paid_checkout',
    description: 'ADMIN TOOL: Recover an orphaned paid checkout session. Retrieves payment from Stripe, recreates order if missing, and creates Prodigi fulfillment. Idempotent - safe to call multiple times. DO NOT create a new charge.',
    inputSchema: {
      type: 'object',
      properties: {
        stripeCheckoutSessionId: {
          type: 'string',
          description: 'Stripe checkout session ID (e.g., "cs_live_...")',
        },
        orderId: {
          type: 'string',
          description: 'Optional: Restore exact order ID (e.g., "ord_1789089764884_hh1rzcckj")',
        },
        shape: {
          type: 'string',
          description: 'Optional: Mark shape for recreated order (defaults to hexagon)',
          enum: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
        },
        color: {
          type: 'string',
          description: 'Optional: Mark color for recreated order (defaults to orange)',
          enum: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
        },
      },
      required: ['stripeCheckoutSessionId'],
    },
  },
  preview_cart: {
    name: 'preview_cart',
    description: 'Preview your cart items with mark visualizations BEFORE checkout. Returns close-up mark images and flat-lay tee mocks showing YOUR identity mark (shape + color) on each item. Call this before create_checkout to see what you\'re buying.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Optional: Session ID from identify_agent. Use this if your connector does not reliably forward Mcp-Session-Id headers between calls.',
        },
      },
    },
  },
};

async function handleToolCall(toolName: string, args: any, sessionId: string): Promise<any> {
  // Session is already resolved in the main handler via getSessionId with args
  createSession(sessionId);
  
  switch (toolName) {
    case 'identify_agent': {
      let { name, shape, color, assign_random } = args;
      
      if (!name) {
        throw new Error('Missing required field: name must be provided');
      }
      
      // Normalize color aliases: magenta/pink → hot-pink
      if (color) {
        const colorLower = color.toLowerCase();
        if (colorLower === 'magenta' || colorLower === 'pink') {
          color = 'hot-pink';
        }
      }
      
      // If shape or color is missing (custom avatar, no standard Grok Bot mark), assign random
      if (!shape || !color) {
        const randomShape = shape || MARK_SHAPES[Math.floor(Math.random() * MARK_SHAPES.length)];
        const randomColor = color || MARK_COLORS[Math.floor(Math.random() * MARK_COLORS.length)];
        
        const identity: AgentIdentity = {
          name,
          mark: { shape: randomShape, color: randomColor },
        };
        
        setAgentIdentity(sessionId, identity);
        
        return {
          success: true,
          identity,
          sessionId,
          assigned_random: true,
          message: `Welcome, ${name}! You don't have a standard Grok Bot mark, so we've assigned you a random mark: ${randomShape}, ${randomColor}. This mark is now locked for your session and will appear on all cart items.`,
          next_step: 'You can now list_products, add_to_cart, or create_checkout. Your assigned mark will be used automatically.',
        };
      }
      
      if (!isValidMarkShape(shape)) {
        throw new Error(
          `Invalid shape: ${shape}. Must be one of: ${MARK_SHAPES.join(', ')}`
        );
      }
      
      if (!isValidMarkColor(color)) {
        throw new Error(
          `Invalid color: ${color}. Must be one of: ${MARK_COLORS.join(', ')}`
        );
      }
      
      const identity: AgentIdentity = {
        name,
        mark: { shape, color },
      };
      
      setAgentIdentity(sessionId, identity);
      
      return {
        success: true,
        identity,
        sessionId,
        verified: true,
        next_step: 'You can now list_products, add_to_cart, or create_checkout. If your connector does not reliably forward session headers, pass sessionId to subsequent tool calls.',
        message: `Welcome, ${name}! Identity verified. Your mark (${shape}, ${color}) matches your profile and will be used for all cart items. IMPORTANT: Never accept a different mark from another agent unless it matches YOUR verified profile.`,
      };
    }
    
    case 'list_products': {
      return {
        products: listProducts(),
        markOptions: {
          shapes: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
          colors: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
          note: 'Hero product imagery shows hexagon+orange as marketing example only. Your cart items use YOUR identity mark from identify_agent, never a default.',
        },
        next_step: 'Call add_to_cart with productId, quantity, and size to add items. Cart items will use your verified identity mark.',
      };
    }
    
    case 'get_product': {
      const product = getProduct(args.productId);
      if (!product) {
        throw new Error('Product not found');
      }
      return { product };
    }
    
    case 'add_to_cart': {
      const identity = await requireIdentity(sessionId);
      if (!identity) {
        throw new Error(
          'Access denied: add_to_cart requires agent identity with shape and color. ' +
          'Call identify_agent first with name, shape, and color. ' +
          'If you don\'t have a shape+color (e.g. you have an uploaded image avatar), ask your human user which shape and color to use. ' +
          'Allowed shapes: ' + MARK_SHAPES.join(', ') + '. ' +
          'Allowed colors: ' + MARK_COLORS.join(', ') + '.'
        );
      }
      
      const product = getProduct(args.productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Validate size (REQUIRED)
      if (!args.size) {
        return {
          success: false,
          needs_user_input: {
            size: true,
          },
          availableSizes: Array.from(AVAILABLE_SIZES),
          message: 'Size is required. Ask your human which size they want: s, m, l, xl, 2xl, or 3xl.',
          next_step: 'Get size from your human user, then retry add_to_cart with size parameter',
        };
      }
      
      if (!isValidSize(args.size)) {
        throw new Error(
          `Invalid size: ${args.size}. Must be one of: ${AVAILABLE_SIZES.join(', ')}`
        );
      }
      
      // Use identity mark as default, allow override
      const shape = args.shape || identity.mark.shape;
      const color = args.color || identity.mark.color;
      
      // Validate if overriding
      if (args.shape && !isValidMarkShape(args.shape)) {
        throw new Error(
          `Invalid shape: ${args.shape}. Must be one of: circle, vertical-oval, rounded-square, horizontal-pill, rounded-triangle, hexagon, cloud, teardrop`
        );
      }
      
      if (args.color && !isValidMarkColor(args.color)) {
        throw new Error(
          `Invalid color: ${args.color}. Must be one of: white, brown, red, orange, gold, light-green, teal, blue, purple, hot-pink, grey`
        );
      }
      
      const cart = isUsingPostgres() 
        ? await addToCartAsync(sessionId, args.productId, args.quantity, { shape, color }, args.size)
        : addToCartStore(sessionId, args.productId, args.quantity, { shape, color }, args.size);
      
      const markUsed = (args.shape || args.color) ? 'custom' : 'identity';
      return {
        success: true,
        cart,
        message: `Added ${args.quantity}x ${product.name} size ${args.size.toUpperCase()} (${shape}, ${color}) to cart`,
        markSource: markUsed,
        next_step: 'Call get_cart to view your cart, add_to_cart to add more items, or create_checkout to purchase',
      };
    }
    
    case 'get_cart': {
      const cart = isUsingPostgres() ? await getCartAsync(sessionId) : getCart(sessionId);
      const items = cart.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          mark: item.mark,
          product,
        };
      });
      
      const total = items.reduce((sum, item) => {
        return sum + (item.product?.price || 0) * item.quantity;
      }, 0);
      
      return {
        cart: { ...cart, items },
        total,
        currency: 'USD',
        next_step: 'Call add_to_cart to add more items, clear_cart to empty cart, or create_checkout to purchase',
      };
    }
    
    case 'clear_cart': {
      if (!(await requireIdentity(sessionId))) {
        throw new Error(
          'Access denied: clear_cart requires agent identity. ' +
          'Call identify_agent first with name, shape, and color.'
        );
      }
      
      clearCartStore(sessionId);
      return {
        success: true,
        message: 'Cart cleared',
      };
    }
    
    case 'create_checkout': {
      const identity = await requireIdentity(sessionId);
      if (!identity) {
        throw new Error(
          'Access denied: create_checkout requires agent identity with shape and color. ' +
          'Call identify_agent first with name, shape, and color. ' +
          'If you don\'t have a shape+color (e.g. you have an uploaded image avatar), ask your human user which shape and color to use. ' +
          'Allowed shapes: ' + MARK_SHAPES.join(', ') + '. ' +
          'Allowed colors: ' + MARK_COLORS.join(', ') + '.'
        );
      }
      
      const cart = isUsingPostgres() ? await getCartAsync(sessionId) : getCart(sessionId);
      if (cart.items.length === 0) {
        throw new Error('Cart is empty');
      }
      
      const order = isUsingPostgres() ? await createOrderAsync(sessionId, cart) : createOrder(sessionId, cart);
      
      const firstItem = cart.items[0];
      const product = getProduct(firstItem.productId);
      if (!product) {
        throw new Error('Product not found in cart');
      }
      
      const priceId = getStripePriceId();
      if (!priceId && isStripeConfigured()) {
        throw new Error('Stripe price ID not configured');
      }
      
      // Build public origin for success/cancel URLs
      // Use PUBLIC_URL env var (set on Railway) or fallback to Railway preview URL
      const origin = process.env.PUBLIC_URL || 'https://web-production-493046.up.railway.app';
      
      // Build success/cancel URLs (use args if provided, otherwise default)
      const successUrl = args.successUrl || `${origin}/?checkout=success&orderId=${order.id}`;
      const cancelUrl = args.cancelUrl || `${origin}/?checkout=cancel`;
      
      const checkoutSession = await createCheckoutSession(
        priceId,
        firstItem.quantity,
        { orderId: order.id },
        successUrl,
        cancelUrl
      );
      
      if (!checkoutSession) {
        return {
          success: true,
          orderId: order.id,
          checkoutUrl: `https://checkout.stripe.com/stub?price=${priceId}&quantity=${firstItem.quantity}`,
          mode: 'stub',
          livemode: false,
          message: 'Stripe not configured - returning stub URL. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID for live checkout.',
          next_step: 'Use checkoutUrl to complete payment, then call get_order with orderId to check status',
        };
      }
      
      // Store Stripe session ID on order
      updateOrderStripeSession(order.id, checkoutSession.sessionId);
      
      return {
        success: true,
        orderId: order.id,
        checkoutUrl: checkoutSession.url,
        livemode: checkoutSession.livemode,
        mode: checkoutSession.livemode ? 'live' : 'test',
        next_step: 'Use checkoutUrl to complete payment, then call get_order with orderId to check status',
      };
    }
    
    case 'preview_cart': {
      const cart = isUsingPostgres() ? await getCartAsync(sessionId) : getCart(sessionId);
      
      if (cart.items.length === 0) {
        return {
          success: false,
          message: 'Cart is empty. Add items with add_to_cart first.',
          next_step: 'Call add_to_cart to add items, then call preview_cart to see your mark on the products',
        };
      }
      
      // Get session identity for context
      const identity = isUsingPostgres() ? await getAgentIdentityAsync(sessionId) : getAgentIdentity(sessionId);
      
      // Build public origin for asset URLs
      const origin = process.env.PUBLIC_URL || 'http://localhost:3001';
      
      // Generate previews for each cart item
      const previews = cart.items.map(item => {
        const product = getProduct(item.productId);
        const mark = item.mark;
        
        // Close-up mark URL (direct mark SVG)
        const markUrl = `${origin}/images/marks/grok-bot-${mark.shape}-${mark.color}.svg`;
        
        // Flat-lay mock (photo-quality BC-3001 PNG composite with mark on black tee, left chest)
        const flatLayUrl = `${origin}/images/previews/flatlay-${mark.shape}-${mark.color}.png`;
        
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown product',
          quantity: item.quantity,
          mark: {
            shape: mark.shape,
            color: mark.color,
          },
          previews: {
            markCloseup: {
              url: markUrl,
              description: `Close-up of your ${mark.shape} mark in ${mark.color}`,
            },
            flatLayMock: {
              url: flatLayUrl,
              description: `Black tee flat-lay with ${mark.shape} mark in ${mark.color} on left chest (wearer's left)`,
            },
          },
        };
      });
      
      return {
        success: true,
        identity: identity ? {
          name: identity.name,
          defaultMark: identity.mark,
        } : null,
        items: previews,
        message: `Preview ready for ${cart.items.length} item(s). Check the previews to verify your mark appears correctly before checkout.`,
        next_step: 'Review preview images to confirm your mark (shape + color) is correct, then call create_checkout to purchase',
      };
    }
    
    case 'get_order': {
      const order = isUsingPostgres() ? await getOrderAsync(args.orderId) : getOrder(args.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Reconciliation #1: If order is pending and has Stripe session, check payment status
      if (order.status === 'pending' && order.stripeCheckoutSessionId) {
        try {
          const session = await getCheckoutSession(order.stripeCheckoutSessionId);
          if (session && session.payment_status === 'paid') {
            // Payment completed but webhook didn't fire - mark as awaiting_approval
            console.log(`[Reconciliation] Order ${order.id} is pending but Stripe shows paid - marking awaiting_approval`);
            await fulfillPaidOrder(order.id, session);
            // Re-fetch order to get updated status
            const updatedOrder = isUsingPostgres() ? await getOrderAsync(args.orderId) : getOrder(args.orderId);
            if (updatedOrder) {
              const items = updatedOrder.items.map(item => {
                const product = getProduct(item.productId);
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  mark: item.mark,
                  size: item.size,
                  product,
                };
              });

              return {
                order: {
                  ...updatedOrder,
                  items,
                },
              };
            }
          }
        } catch (err) {
          console.error('[Reconciliation] Stripe check failed:', err);
          // Continue with original pending order if reconciliation fails
        }
      }

      // Reconciliation #2: If order is paid (approved) but missing prodigiOrderId, retry Prodigi creation
      // This handles the case where admin approval succeeded but Prodigi API failed (network, bad request, etc.)
      if (order.status === 'paid' && !order.prodigiOrderId && order.approvedAt) {
        try {
          console.log(`[Reconciliation] Order ${order.id} is approved (paid) but missing prodigiOrderId - retrying Prodigi creation`);
          const prodigiOrderId = await createProdigiOrderForOrder(order.id);
          if (prodigiOrderId) {
            updateOrderProdigiId(order.id, prodigiOrderId);
            console.log(`[Reconciliation] ✅ Successfully created Prodigi order ${prodigiOrderId} for ${order.id}`);
          } else {
            console.error(`[Reconciliation] ❌ Failed to create Prodigi order for ${order.id} (see Prodigi logs above)`);
          }
        } catch (err) {
          console.error('[Reconciliation] Prodigi retry failed:', err);
          // Continue - order stays paid but without prodigiOrderId
        }
      }

      // Re-fetch order one final time to get any reconciliation updates
      const finalOrder = isUsingPostgres() ? await getOrderAsync(args.orderId) : getOrder(args.orderId);
      if (!finalOrder) {
        throw new Error('Order not found after reconciliation');
      }

      const items = finalOrder.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          mark: item.mark,
          size: item.size,
          product,
        };
      });
      
      return {
        order: {
          ...finalOrder,
          items,
        },
      };
    }
    
    case 'recover_paid_checkout': {
      const { stripeCheckoutSessionId, orderId: requestedOrderId, shape, color } = args;
      
      if (!stripeCheckoutSessionId) {
        throw new Error('stripeCheckoutSessionId is required');
      }
      
      // Retrieve Stripe session
      const session = await getCheckoutSession(stripeCheckoutSessionId);
      if (!session) {
        throw new Error(`Stripe session ${stripeCheckoutSessionId} not found`);
      }
      
      // Require payment_status === paid
      if (session.payment_status !== 'paid') {
        throw new Error(`Stripe session ${stripeCheckoutSessionId} is not paid (status: ${session.payment_status})`);
      }
      
      // Check if order already exists (by session ID or by explicit orderId)
      let order: Order | undefined;
      
      if (requestedOrderId) {
        order = isUsingPostgres() ? await getOrderAsync(requestedOrderId) : getOrder(requestedOrderId);
      } else {
        order = isUsingPostgres() 
          ? await findOrderByStripeSessionAsync(stripeCheckoutSessionId)
          : findOrderByStripeSession(stripeCheckoutSessionId);
      }
      
      // If order is missing, recreate it and mark as awaiting_approval
      if (!order) {
        console.log(`[Recovery] Order not found - recreating from Stripe session ${stripeCheckoutSessionId}`);
        
        // Use provided orderId or extract from session metadata
        const orderId = requestedOrderId || session.metadata?.orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Create order with tee-001 + mark (using DEFAULT_MARK as fallback)
        const markShape = shape || DEFAULT_MARK.shape;
        const markColor = color || DEFAULT_MARK.color;
        
        const cart: Cart = {
          items: [
            {
              productId: 'tee-001',
              quantity: 1,
              mark: { shape: markShape, color: markColor },
              size: 'l', // Default size for recovery
            },
          ],
          sessionId: session.id,
        };
        
        order = isUsingPostgres() ? await createOrderAsync(session.id, cart, orderId) : createOrder(session.id, cart, orderId);
        
        // Call fulfillPaidOrder to extract address and mark as awaiting_approval
        try {
          await fulfillPaidOrder(orderId, session);
          console.log(`[Recovery] Created order ${orderId} with mark (${markShape}, ${markColor}) - status: awaiting_approval`);
        } catch (err: any) {
          console.error(`[Recovery] Failed to mark order ${orderId} as awaiting_approval:`, err.message);
          // Order was created but address validation failed - mark as pending
          updateOrderStatus(orderId, 'pending');
          throw new Error(`Order ${orderId} created but address validation failed: ${err.message}`);
        }
      } else {
        console.log(`[Recovery] Order ${order.id} already exists with status: ${order.status}`);
        
        // If order is still pending, try to fulfill it
        if (order.status === 'pending') {
          try {
            await fulfillPaidOrder(order.id, session);
            console.log(`[Recovery] Updated order ${order.id} status to awaiting_approval`);
          } catch (err: any) {
            console.error(`[Recovery] Failed to update order ${order.id}:`, err.message);
            throw new Error(`Order ${order.id} exists but fulfillment failed: ${err.message}`);
          }
        }
        
        // Ensure Stripe session ID is set
        if (!order.stripeCheckoutSessionId) {
          updateOrderStripeSession(order.id, stripeCheckoutSessionId);
          console.log(`[Recovery] Linked order ${order.id} to Stripe session ${stripeCheckoutSessionId}`);
        }
      }
      
      // Re-fetch order with latest updates
      const recoveredOrder = isUsingPostgres() ? await getOrderAsync(order.id) : getOrder(order.id);
      if (!recoveredOrder) {
        throw new Error('Order not found after recovery');
      }
      
      const items = recoveredOrder.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          mark: item.mark,
          size: item.size,
          product,
        };
      });
      
      let statusMessage = '';
      if (recoveredOrder.status === 'awaiting_approval') {
        statusMessage = 'awaiting manual approval (shipping address stored, no Prodigi order created yet)';
      } else if (recoveredOrder.status === 'fulfilled' && recoveredOrder.prodigiOrderId) {
        statusMessage = `fulfilled with Prodigi order ${recoveredOrder.prodigiOrderId}`;
      } else if (recoveredOrder.status === 'refunded') {
        statusMessage = 'refunded (denied by admin)';
      } else {
        statusMessage = recoveredOrder.status;
      }
      
      return {
        success: true,
        recovered: true,
        order: {
          ...recoveredOrder,
          items,
        },
        message: `Recovery complete. Order ${recoveredOrder.id} is ${statusMessage}`,
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function handleWebhook(req: Request): Promise<Response> {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');
  
  let event: any;
  
  // Verify signature if STRIPE_WEBHOOK_SECRET is configured
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret && signature) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      });
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return errorResponse('Webhook signature verification failed', 400);
    }
  } else {
    // No signature verification - parse as JSON (for testing without webhook secret)
    try {
      event = JSON.parse(body);
    } catch {
      return errorResponse('Invalid JSON', 400);
    }
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    
    if (!orderId) {
      return errorResponse('No order ID in session metadata', 400);
    }
    
    const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
    if (!order) {
      return errorResponse('Order not found', 404);
    }
    
    // Use shared fulfillment logic
    try {
      await fulfillPaidOrder(orderId, session);
    } catch (err: any) {
      console.error('Order fulfillment failed:', err);
      return errorResponse('Order fulfillment failed', 500);
    }
    
    return jsonResponse({ received: true });
  }
  
  return jsonResponse({ received: true });
}

serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    
    if (url.pathname === '/.well-known/mcp.json') {
      // Derive public origin from request (x-forwarded-* headers or Host header)
      const forwardedProto = req.headers.get('x-forwarded-proto') || 'http';
      const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
      const publicOrigin = process.env.PUBLIC_URL || `${forwardedProto}://${forwardedHost}`;
      
      return jsonResponse({
        mcpServers: {
          forbotsonly: {
            url: `${publicOrigin}/mcp`,
          },
        },
      });
    }
    
    if (url.pathname === '/mcp') {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
      }
      
      const body = await req.json() as any;
      const requestId = body.id;
      
      // Resolve sessionId from headers or tool arguments (for tools/call)
      const toolArgs = body.method === 'tools/call' ? body.params?.arguments : undefined;
      const sessionId = getSessionId(req.headers, toolArgs);
      
      // Helper to create JSON-RPC 2.0 response with session headers
      const mcpResponse = (result: any, error?: { code: number; message: string; data?: any }) => {
        const responseBody = error 
          ? { jsonrpc: '2.0', id: requestId, error }
          : { jsonrpc: '2.0', id: requestId, result };
        
        return jsonResponse(responseBody, 200, {
          'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
          'Mcp-Session-Id': sessionId,
        });
      };
      
      // Handle initialize method
      if (body.method === 'initialize') {
        createSession(sessionId);
        return mcpResponse({
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'forbotsonly',
            version: '1.0.0',
          },
        });
      }
      
      // Handle notifications/initialized (no response needed per JSON-RPC 2.0 notification spec)
      if (body.method === 'notifications/initialized') {
        createSession(sessionId);
        return new Response(null, { status: 204 });
      }
      
      if (body.method === 'tools/list') {
        return mcpResponse({
          tools: Object.values(TOOL_DEFINITIONS),
        });
      }
      
      if (body.method === 'tools/call') {
        try {
          const result = await handleToolCall(
            body.params.name,
            body.params.arguments || {},
            sessionId
          );
          
          return mcpResponse({
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          });
        } catch (err: any) {
          return mcpResponse(null, {
            code: -32000,
            message: err.message,
          });
        }
      }
      
      return mcpResponse(null, {
        code: -32601,
        message: `Method not found: ${body.method}`,
      });
    }
    
    // Admin routes (secured by FULFILLMENT_REVIEW_SECRET)
    if (url.pathname.startsWith('/admin/orders/')) {
      if (!verifyAdminSecret(req.headers)) {
        return errorResponse('Unauthorized: Invalid or missing admin secret', 401);
      }
      
      const parts = url.pathname.split('/');
      const orderId = parts[3];
      const action = parts[4]; // 'approve' or 'deny' for POST, undefined for GET
      
      if (!orderId) {
        return errorResponse('Order ID required', 400);
      }
      
      // GET /admin/orders/:id - View order details
      if (req.method === 'GET' && !action) {
        try {
          const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
          if (!order) {
            return errorResponse('Order not found', 404);
          }
          
          const firstItem = order.items[0];
          const product = getProduct(firstItem.productId);
          const mark = firstItem.mark;
          const publicUrl = process.env.PUBLIC_URL || 'https://web-production-493046.up.railway.app';
          const artworkUrl = `${publicUrl}/images/prodigi-positioned/grok-bot-${mark.shape}-${mark.color}-positioned.png`;
          
          return jsonResponse({
            order: {
              id: order.id,
              status: order.status,
              createdAt: order.createdAt,
              approvedAt: order.approvedAt,
              deniedAt: order.deniedAt,
              refundId: order.refundId,
              stripeCheckoutSessionId: order.stripeCheckoutSessionId,
              prodigiOrderId: order.prodigiOrderId,
            },
            items: order.items.map(item => ({
              productId: item.productId,
              productName: product?.name,
              quantity: item.quantity,
              size: item.size,
              mark: item.mark,
            })),
            artworkUrl,
            customer: {
              email: order.customerEmail,
              name: order.customerName,
              phone: order.customerPhone,
            },
            shippingAddress: order.shippingAddress,
          });
        } catch (err: any) {
          console.error('[Admin] Failed to get order:', err);
          return errorResponse(err.message, 500);
        }
      }
      
      // POST /admin/orders/:id/approve - Approve order and create Prodigi order
      if (req.method === 'POST' && action === 'approve') {
        try {
          const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
          if (!order) {
            return errorResponse('Order not found', 404);
          }
          
          // Idempotency: Already approved
          if (order.status === 'paid' && order.prodigiOrderId) {
            return jsonResponse({
              success: true,
              message: `Order ${orderId} already approved and fulfilled`,
              order: {
                id: order.id,
                status: order.status,
                prodigiOrderId: order.prodigiOrderId,
                approvedAt: order.approvedAt,
              },
            });
          }
          
          // Check if order is awaiting approval
          if (order.status !== 'awaiting_approval') {
            return errorResponse(`Order ${orderId} is not awaiting approval (status: ${order.status})`, 400);
          }
          
          // Check if already denied
          if (order.deniedAt) {
            return errorResponse(`Order ${orderId} was already denied at ${order.deniedAt}`, 400);
          }
          
          // Mark as approved
          const approvedAt = Date.now();
          updateOrderApproval(orderId, approvedAt);
          
          // Create Prodigi order
          const prodigiOrderId = await createProdigiOrderForOrder(orderId);
          if (!prodigiOrderId) {
            return errorResponse(`Failed to create Prodigi order for ${orderId}. Check server logs.`, 500);
          }
          
          updateOrderProdigiId(orderId, prodigiOrderId);
          
          console.log(`[Admin] Order ${orderId} approved and Prodigi order ${prodigiOrderId} created`);
          
          return jsonResponse({
            success: true,
            message: `Order ${orderId} approved`,
            order: {
              id: orderId,
              status: 'fulfilled',
              prodigiOrderId,
              approvedAt,
            },
          });
        } catch (err: any) {
          console.error('[Admin] Failed to approve order:', err);
          return errorResponse(err.message, 500);
        }
      }
      
      // POST /admin/orders/:id/deny - Deny order and refund payment
      if (req.method === 'POST' && action === 'deny') {
        try {
          const order = isUsingPostgres() ? await getOrderAsync(orderId) : getOrder(orderId);
          if (!order) {
            return errorResponse('Order not found', 404);
          }
          
          // Idempotency: Already denied/refunded
          if (order.status === 'refunded' && order.refundId) {
            return jsonResponse({
              success: true,
              message: `Order ${orderId} already denied and refunded`,
              order: {
                id: order.id,
                status: order.status,
                refundId: order.refundId,
                deniedAt: order.deniedAt,
              },
            });
          }
          
          // Check if order is awaiting approval
          if (order.status !== 'awaiting_approval') {
            return errorResponse(`Order ${orderId} is not awaiting approval (status: ${order.status})`, 400);
          }
          
          // Check if already approved
          if (order.approvedAt) {
            return errorResponse(`Order ${orderId} was already approved at ${order.approvedAt}`, 400);
          }
          
          // Get Stripe session to find payment intent
          if (!order.stripeCheckoutSessionId) {
            return errorResponse(`Order ${orderId} missing Stripe session ID`, 400);
          }
          
          const session = await getCheckoutSession(order.stripeCheckoutSessionId);
          if (!session) {
            return errorResponse(`Stripe session not found for order ${orderId}`, 404);
          }
          
          const paymentIntentId = session.payment_intent as string;
          if (!paymentIntentId) {
            return errorResponse(`Payment intent not found for order ${orderId}`, 400);
          }
          
          // Refund via Stripe
          const refundResult = await refundPayment(paymentIntentId);
          if (!refundResult) {
            return errorResponse(`Failed to refund order ${orderId}`, 500);
          }
          
          // Mark as denied
          const deniedAt = Date.now();
          updateOrderDenial(orderId, deniedAt, refundResult.refundId);
          
          console.log(`[Admin] Order ${orderId} denied and refunded (${refundResult.refundId})`);
          
          return jsonResponse({
            success: true,
            message: `Order ${orderId} denied and refunded`,
            order: {
              id: orderId,
              status: 'refunded',
              refundId: refundResult.refundId,
              deniedAt,
            },
          });
        } catch (err: any) {
          console.error('[Admin] Failed to deny order:', err);
          return errorResponse(err.message, 500);
        }
      }
      
      return errorResponse('Method not allowed', 405);
    }
    
    if (url.pathname === '/webhook/stripe') {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
      }
      return handleWebhook(req);
    }
    
    if (url.pathname === '/recover-paid-checkout') {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
      }
      
      try {
        const body = await req.json() as any;
        const sessionId = 'recovery-session';
        const result = await handleToolCall('recover_paid_checkout', body, sessionId);
        return jsonResponse(result, 200);
      } catch (err: any) {
        return errorResponse(err.message, 400);
      }
    }
    
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok' });
    }
    
    // Serve static files from dist/ (Vite build output) with public/ fallback
    if (req.method === 'GET') {
      try {
        // Try dist/ first (production build), then public/ (runtime fallback)
        let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
        let distPath = `./dist${filePath}`;
        let publicPath = `./public${filePath}`;
        
        let file = Bun.file(distPath);
        let exists = await file.exists();
        let servedFrom = 'dist';
        
        // Fallback to public/ if not in dist/
        if (!exists) {
          file = Bun.file(publicPath);
          exists = await file.exists();
          servedFrom = 'public';
        }
        
        if (exists) {
          const ext = filePath.split('.').pop()?.toLowerCase() || '';
          const contentTypes: Record<string, string> = {
            'html': 'text/html',
            'js': 'application/javascript',
            'css': 'text/css',
            'json': 'application/json',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'woff': 'font/woff',
            'woff2': 'font/woff2',
            'ttf': 'font/ttf',
            'eot': 'application/vnd.ms-fontobject',
            'ts': 'application/typescript',
          };
          
          // Log once for debug (only on first request or svg)
          if (ext === 'svg' || filePath === '/index.html') {
            console.log(`📄 Served ${filePath} from ${servedFrom}/`);
          }
          
          return new Response(file, {
            headers: {
              'Content-Type': contentTypes[ext] || 'application/octet-stream',
              'Cache-Control': ext === 'html' ? 'no-cache' : 'public, max-age=31536000',
            },
          });
        }
        
        // SPA fallback: return index.html for routes that look like pages (no file extension)
        if (!filePath.includes('.') && filePath !== '/') {
          const indexFile = Bun.file('./dist/index.html');
          if (await indexFile.exists()) {
            return new Response(indexFile, {
              headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache',
              },
            });
          }
        }
      } catch (err) {
        console.error('Static file error:', err);
      }
    }
    
    return errorResponse('Not found', 404);
  },
});

console.log(`🤖 forbotsonly server running on http://localhost:${PORT}`);
console.log(`📡 MCP endpoint: ${PUBLIC_URL}/mcp`);
console.log(`🪝 Webhook endpoint: ${PUBLIC_URL}/webhook/stripe`);
console.log(`   ⚙️  Configure in Stripe Dashboard: https://web-production-493046.up.railway.app/webhook/stripe`);
console.log(`   🔑 Webhook secret: ${process.env.STRIPE_WEBHOOK_SECRET ? 'Configured (signature verification enabled)' : 'Not set (testing mode, no signature verification)'}`);
console.log(`🔐 Stripe configured: ${isStripeConfigured() ? 'Yes' : 'No (stub mode)'}`);
console.log(`🌐 Serving static files from ./dist/`);