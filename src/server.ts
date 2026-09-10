import { serve } from 'bun';
import {
  createSession,
  getSession,
  setAgentIdentity,
  getAgentIdentity,
  isGrokBotFamily,
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
import type { AgentIdentity } from './types';

const PORT = parseInt(process.env.PORT || '3001');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

function getSessionId(headers: Headers): string {
  const sessionCookie = headers.get('cookie')
    ?.split(';')
    .find(c => c.trim().startsWith('session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1];
  }
  
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

function requireGrokBot(sessionId: string): AgentIdentity | null {
  const agent = getAgentIdentity(sessionId);
  if (!isGrokBotFamily(agent)) {
    return null;
  }
  return agent!;
}

const TOOL_DEFINITIONS = {
  identify_agent: {
    name: 'identify_agent',
    description: 'Identify the agent to enable store access. Required before using other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Agent name (e.g., "Grok Bot", "Shopping Assistant")',
        },
        family: {
          type: 'string',
          description: 'Agent family or type (optional)',
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of agent capabilities (optional)',
        },
      },
      required: ['name'],
    },
  },
  list_products: {
    name: 'list_products',
    description: 'List all available products in the store',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_product: {
    name: 'get_product',
    description: 'Get detailed information about a specific product',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID',
        },
      },
      required: ['productId'],
    },
  },
  add_to_cart: {
    name: 'add_to_cart',
    description: 'Add a product to the cart (Grok Bot family only)',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID',
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add',
          minimum: 1,
        },
      },
      required: ['productId', 'quantity'],
    },
  },
  get_cart: {
    name: 'get_cart',
    description: 'Get the current cart contents',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  clear_cart: {
    name: 'clear_cart',
    description: 'Clear all items from the cart (Grok Bot family only)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  create_checkout: {
    name: 'create_checkout',
    description: 'Create a Stripe checkout session for the cart (Grok Bot family only)',
    inputSchema: {
      type: 'object',
      properties: {
        successUrl: {
          type: 'string',
          description: 'URL to redirect to after successful payment',
        },
        cancelUrl: {
          type: 'string',
          description: 'URL to redirect to if payment is cancelled',
        },
      },
      required: ['successUrl', 'cancelUrl'],
    },
  },
  get_order: {
    name: 'get_order',
    description: 'Get order details by order ID',
    inputSchema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Order ID',
        },
      },
      required: ['orderId'],
    },
  },
};

async function handleToolCall(toolName: string, args: any, sessionId: string): Promise<any> {
  createSession(sessionId);
  
  switch (toolName) {
    case 'identify_agent': {
      const identity: AgentIdentity = {
        name: args.name,
        family: args.family,
        capabilities: args.capabilities,
      };
      setAgentIdentity(sessionId, identity);
      
      const isGrok = isGrokBotFamily(identity);
      return {
        success: true,
        agent: identity,
        access: isGrok ? 'full' : 'read-only',
        message: isGrok
          ? 'Welcome! You have full access to mutating tools.'
          : 'Identity recorded. Note: mutating tools (cart, checkout) are restricted to Grok Bot family agents.',
      };
    }
    
    case 'list_products': {
      return {
        products: listProducts(),
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
      const agent = requireGrokBot(sessionId);
      if (!agent) {
        throw new Error('Access denied: add_to_cart requires Grok Bot family identity');
      }
      
      const product = getProduct(args.productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      const cart = addToCartStore(sessionId, args.productId, args.quantity);
      return {
        success: true,
        cart,
        message: `Added ${args.quantity}x ${product.name} to cart`,
      };
    }
    
    case 'get_cart': {
      const cart = getCart(sessionId);
      const items = cart.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
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
      };
    }
    
    case 'clear_cart': {
      const agent = requireGrokBot(sessionId);
      if (!agent) {
        throw new Error('Access denied: clear_cart requires Grok Bot family identity');
      }
      
      clearCartStore(sessionId);
      return {
        success: true,
        message: 'Cart cleared',
      };
    }
    
    case 'create_checkout': {
      const agent = requireGrokBot(sessionId);
      if (!agent) {
        throw new Error('Access denied: create_checkout requires Grok Bot family identity');
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
      
      const checkoutUrl = await createCheckoutSession(
        priceId,
        firstItem.quantity,
        { orderId: order.id },
        args.successUrl,
        args.cancelUrl
      );
      
      if (checkoutUrl.includes('stripe.com/stub')) {
        return {
          success: true,
          orderId: order.id,
          checkoutUrl,
          mode: 'stub',
          message: 'Stripe not configured - returning stub URL. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID for live checkout.',
        };
      }
      
      return {
        success: true,
        orderId: order.id,
        checkoutUrl,
        mode: 'live',
      };
    }
    
    case 'get_order': {
      const order = getOrder(args.orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      const items = order.items.map(item => {
        const product = getProduct(item.productId);
        return {
          productId: item.productId,
          quantity: item.quantity,
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
  
  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return errorResponse('Invalid JSON', 400);
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
    
    updateOrderStatus(orderId, 'paid');
    updateOrderStripeSession(orderId, session.id);
    
    const prodigiClient = createProdigiClient();
    const firstItem = order.items[0];
    const product = getProduct(firstItem.productId);
    
    if (product && process.env.PRODIGI_API_KEY) {
      try {
        const prodigiOrder = await prodigiClient.createOrder({
          shippingMethod: 'Standard',
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
                  url: 'https://example.com/artwork.png',
                },
              ],
            },
          ],
        });
        
        updateOrderProdigiId(orderId, prodigiOrder.id);
      } catch (err) {
        console.error('Prodigi order creation failed:', err);
      }
    }
    
    return jsonResponse({ received: true });
  }
  
  return jsonResponse({ received: true });
}

serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const sessionId = getSessionId(req.headers);
    
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
      return jsonResponse({
        mcpServers: {
          forbotsonly: {
            url: `${PUBLIC_URL}/mcp`,
          },
        },
      });
    }
    
    if (url.pathname === '/mcp') {
      if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
      }
      
      const body = await req.json();
      
      if (body.method === 'tools/list') {
        return jsonResponse({
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
          
          return jsonResponse(
            { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
            200,
            { 'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` }
          );
        } catch (err: any) {
          return jsonResponse(
            { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
            200,
            { 'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400` }
          );
        }
      }
      
      return errorResponse('Unknown MCP method', 400);
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
    
    return errorResponse('Not found', 404);
  },
});

console.log(`🤖 forbotsonly server running on http://localhost:${PORT}`);
console.log(`📡 MCP endpoint: ${PUBLIC_URL}/mcp`);
console.log(`🪝 Webhook endpoint: ${PUBLIC_URL}/webhook/stripe`);
console.log(`🔐 Stripe configured: ${isStripeConfigured() ? 'Yes' : 'No (stub mode)'}`);
