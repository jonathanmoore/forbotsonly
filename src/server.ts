import { serve } from 'bun';
import Stripe from 'stripe';
import {
  createSession,
  getSession,
  setAgentIdentity,
  getAgentIdentity,
  isIdentified,
  getCart,
  addToCart as addToCartStore,
  clearCart as clearCartStore,
  createOrder,
  getOrder,
  updateOrderStripeSession,
  updateOrderProdigiId,
  updateOrderStatus,
  findOrderByStripeSession,
} from './store';
import { getProduct, listProducts, getStripePriceId } from './products';
import { createCheckoutSession, isStripeConfigured, getCheckoutSession } from './stripe';
import { createProdigiClient } from './prodigi';
import { isValidMarkShape, isValidMarkColor, DEFAULT_MARK, MARK_SHAPES, MARK_COLORS, type AgentIdentity, type Order } from './types';

const PORT = parseInt(process.env.PORT || '3001');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

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

function requireIdentity(sessionId: string): AgentIdentity | null {
  return getAgentIdentity(sessionId) || null;
}

/**
 * Shared order fulfillment logic.
 * Called by both webhook handler and get_order reconciliation.
 * Updates order status to 'paid', creates Prodigi order, and stores Prodigi ID.
 */
async function fulfillPaidOrder(orderId: string, session: Stripe.Checkout.Session): Promise<void> {
  const order = getOrder(orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Update order status to paid
  updateOrderStatus(orderId, 'paid');
  updateOrderStripeSession(orderId, session.id);

  // Create Prodigi order if API key is configured
  const prodigiClient = createProdigiClient();
  const firstItem = order.items[0];
  const product = getProduct(firstItem.productId);

  if (product && process.env.PRODIGI_API_KEY) {
    try {
      const prodigiOrder = await prodigiClient.createOrder({
        shippingMethod: 'Standard', // LOCK: Standard only, never Express (cost control)
        recipient: {
          name: session.customer_details?.name || 'Customer',
          address: {
            line1: session.shipping_details?.address?.line1 || '',
            line2: session.shipping_details?.address?.line2 || '',
            postalOrZipCode: session.shipping_details?.address?.postal_code || '',
            countryCode: session.shipping_details?.address?.country || 'US',
            townOrCity: session.shipping_details?.address?.city || '',
            stateOrCounty: session.shipping_details?.address?.state || '',
          },
        },
        items: [
          {
            sku: product.sku,
            copies: firstItem.quantity,
            attributes: product.attributes,
            assets: [
              {
                printArea: 'front',
                // TODO: Replace with real baked front canvas URL
                // Specs: 360x360px mark (~1.2" @ 300dpi) on 2480x3507px (or larger) transparent canvas
                // Mark: pocket-grok-bot-{shape}-{color}.svg rasterized at reduced size (40% smaller than 2")
                // Placement: left chest (right half of front canvas), 2.5-4" below HPS
                // See PRODUCT_IMAGERY.md for full bake specifications
                url: 'https://example.com/artwork.png',
              },
            ],
          },
        ],
      });

      updateOrderProdigiId(orderId, prodigiOrder.id);
    } catch (err) {
      console.error('Prodigi order creation failed:', err);
      // Don't throw - order is still marked as paid even if Prodigi fails
    }
  }
}

const TOOL_DEFINITIONS = {
  identify_agent: {
    name: 'identify_agent',
    description: 'Call this FIRST before any cart or checkout operations. Provide your agent name, mark shape, and mark color. Your identity unlocks mutating tools and becomes your default tee mark.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Your agent name. Examples: "Grok Bot", "Chief of Staff", "Shopping Assistant"',
        },
        shape: {
          type: 'string',
          description: 'Your mark shape. Pick one from the allowed values.',
          enum: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
        },
        color: {
          type: 'string',
          description: 'Your mark color. Pick one from the allowed values.',
          enum: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
        },
      },
      required: ['name', 'shape', 'color'],
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
    description: 'Add a product to your cart. Your session mark (from identify_agent) is used automatically. Optionally override shape and/or color for this item only.',
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
      required: ['productId', 'quantity'],
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
};

async function handleToolCall(toolName: string, args: any, sessionId: string): Promise<any> {
  // Session is already resolved in the main handler via getSessionId with args
  createSession(sessionId);
  
  switch (toolName) {
    case 'identify_agent': {
      const { name, shape, color } = args;
      
      if (!name) {
        throw new Error('Missing required field: name must be provided');
      }
      
      // If shape or color is missing (agent doesn't have a Grok Bot mark, e.g. custom/upload image avatar)
      if (!shape || !color) {
        return {
          success: false,
          needs_user_input: {
            shape: !shape,
            color: !color,
          },
          enums: {
            shapes: MARK_SHAPES,
            colors: MARK_COLORS,
          },
          message: 'Ask your human which shape and color to print. Once you have them, call identify_agent again with name, shape, and color.',
          next_step: 'Get shape and color from your human user, then retry identify_agent with all three parameters',
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
        next_step: 'You can now list_products, add_to_cart, or create_checkout. If your connector does not reliably forward session headers, pass sessionId to subsequent tool calls.',
        message: `Welcome, ${name}! You have full access to mutating tools. Your identity mark (${shape}, ${color}) will be used for cart items.`,
      };
    }
    
    case 'list_products': {
      return {
        products: listProducts(),
        markOptions: {
          shapes: ['circle', 'vertical-oval', 'rounded-square', 'horizontal-pill', 'rounded-triangle', 'hexagon', 'cloud', 'teardrop'],
          colors: ['white', 'brown', 'red', 'orange', 'gold', 'light-green', 'teal', 'blue', 'purple', 'hot-pink', 'grey'],
          default: { shape: 'hexagon', color: 'orange' },
        },
        next_step: 'Call add_to_cart with productId and quantity to add items',
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
      const identity = requireIdentity(sessionId);
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
      
      const cart = addToCartStore(sessionId, args.productId, args.quantity, {
        shape,
        color,
      });
      
      const markUsed = (args.shape || args.color) ? 'custom' : 'identity';
      return {
        success: true,
        cart,
        message: `Added ${args.quantity}x ${product.name} (${shape}, ${color}) to cart`,
        markSource: markUsed,
        next_step: 'Call get_cart to view your cart, add_to_cart to add more items, or create_checkout to purchase',
      };
    }
    
    case 'get_cart': {
      const cart = getCart(sessionId);
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
      if (!requireIdentity(sessionId)) {
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
      const identity = requireIdentity(sessionId);
      if (!identity) {
        throw new Error(
          'Access denied: create_checkout requires agent identity with shape and color. ' +
          'Call identify_agent first with name, shape, and color. ' +
          'If you don\'t have a shape+color (e.g. you have an uploaded image avatar), ask your human user which shape and color to use. ' +
          'Allowed shapes: ' + MARK_SHAPES.join(', ') + '. ' +
          'Allowed colors: ' + MARK_COLORS.join(', ') + '.'
        );
      }
      
      const cart = getCart(sessionId);
      if (cart.items.length === 0) {
        throw new Error('Cart is empty');
      }
      
      const order = createOrder(sessionId, cart);
      
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
    
    case 'get_order': {
      const order = getOrder(args.orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Reconciliation: If order is pending and has Stripe session, check payment status
      if (order.status === 'pending' && order.stripeCheckoutSessionId) {
        try {
          const session = await getCheckoutSession(order.stripeCheckoutSessionId);
          if (session && session.payment_status === 'paid') {
            // Payment completed but webhook didn't fire - fulfill now
            await fulfillPaidOrder(order.id, session);
            // Re-fetch order to get updated status
            const updatedOrder = getOrder(args.orderId);
            if (updatedOrder) {
              const items = updatedOrder.items.map(item => {
                const product = getProduct(item.productId);
                return {
                  productId: item.productId,
                  quantity: item.quantity,
                  mark: item.mark,
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
          console.error('Stripe reconciliation failed:', err);
          // Continue with original pending order if reconciliation fails
        }
      }

      const items = order.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
          mark: item.mark,
          product,
        };
      });
      
      return {
        order: {
          ...order,
          items,
        },
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
        apiVersion: '2024-11-20.acacia',
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
    
    const order = getOrder(orderId);
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
      
      const body = await req.json();
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
    
    if (url.pathname === '/webhook/stripe') {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
      }
      return handleWebhook(req);
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