import type { AgentIdentity, Cart, CartItem, Order, MarkConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

const { Pool } = pg;

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const DATABASE_URL = process.env.DATABASE_URL;

// Postgres pool (null if not configured)
let pool: pg.Pool | null = null;
let usePostgres = false;

// In-memory fallback for JSON file mode
const sessions = new Map<string, { identity?: AgentIdentity; cart: Cart }>();
const orders = new Map<string, Order>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSessionsFromFile(): Map<string, { identity?: AgentIdentity; cart: Cart }> {
  ensureDataDir();
  if (fs.existsSync(SESSIONS_FILE)) {
    try {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    } catch (err) {
      console.error('[Store] Failed to load sessions:', err);
    }
  }
  return new Map();
}

function loadOrdersFromFile(): Map<string, Order> {
  ensureDataDir();
  if (fs.existsSync(ORDERS_FILE)) {
    try {
      const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    } catch (err) {
      console.error('[Store] Failed to load orders:', err);
    }
  }
  return new Map();
}

function saveSessionsToFile(): void {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save sessions:', err);
  }
}

function saveOrdersToFile(): void {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(orders.entries());
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save orders:', err);
  }
}

async function initPostgres(): Promise<void> {
  if (!DATABASE_URL) {
    console.log('[Store] DATABASE_URL not configured - using JSON file storage');
    return;
  }

  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    // Test connection
    const client = await pool.connect();
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        identity_name TEXT,
        identity_mark_shape TEXT,
        identity_mark_color TEXT,
        cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL,
        stripe_checkout_session_id TEXT,
        prodigi_order_id TEXT,
        items JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        approved_at BIGINT,
        denied_at BIGINT,
        refund_id TEXT,
        shipping_address JSONB,
        customer_email TEXT,
        customer_name TEXT,
        customer_phone TEXT
      )
    `);

    // Create index on stripe_checkout_session_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_stripe_session 
      ON orders(stripe_checkout_session_id)
    `);

    client.release();

    // Migrate existing orders.json if present
    await migrateOrdersFromFile();

    usePostgres = true;
    console.log('[Store] Connected to Postgres - using database storage');
  } catch (err: any) {
    console.error('[Store] Failed to connect to Postgres:', err.message);
    console.log('[Store] Falling back to JSON file storage');
    pool = null;
    usePostgres = false;
  }
}

async function migrateOrdersFromFile(): Promise<void> {
  if (!pool || !fs.existsSync(ORDERS_FILE)) {
    return;
  }

  try {
    const fileOrders = loadOrdersFromFile();
    if (fileOrders.size === 0) {
      return;
    }

    console.log(`[Store] Migrating ${fileOrders.size} orders from ${ORDERS_FILE} to Postgres...`);

    for (const [orderId, order] of fileOrders.entries()) {
      await pool.query(
        `INSERT INTO orders (id, session_id, status, stripe_checkout_session_id, prodigi_order_id, items, created_at, approved_at, denied_at, refund_id, shipping_address, customer_email, customer_name, customer_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          order.id,
          order.sessionId,
          order.status,
          order.stripeCheckoutSessionId || null,
          order.prodigiOrderId || null,
          JSON.stringify(order.items),
          order.createdAt,
          order.approvedAt || null,
          order.deniedAt || null,
          order.refundId || null,
          order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
          order.customerEmail || null,
          order.customerName || null,
          order.customerPhone || null,
        ]
      );
    }

    console.log(`[Store] Migration complete - backed up original to ${ORDERS_FILE}.migrated`);
    fs.renameSync(ORDERS_FILE, `${ORDERS_FILE}.migrated`);
  } catch (err) {
    console.error('[Store] Migration failed:', err);
  }
}

// Initialize storage
await initPostgres();

if (!usePostgres) {
  // Load from files in fallback mode
  sessions.clear();
  orders.clear();
  const loadedSessions = loadSessionsFromFile();
  const loadedOrders = loadOrdersFromFile();
  for (const [key, value] of loadedSessions.entries()) {
    sessions.set(key, value);
  }
  for (const [key, value] of loadedOrders.entries()) {
    orders.set(key, value);
  }
  console.log(`[Store] Loaded ${sessions.size} sessions and ${orders.size} orders from ${DATA_DIR}`);
}

// ============================================================================
// Session Operations
// ============================================================================

export function createSession(sessionId: string): void {
  if (usePostgres && pool) {
    // Postgres mode: upsert session
    pool.query(
      `INSERT INTO sessions (session_id, cart_items)
       VALUES ($1, $2)
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId, JSON.stringify([])]
    ).catch(err => {
      console.error('[Store] Failed to create session:', err);
    });
  } else {
    // JSON file mode
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, {
        cart: { items: [], sessionId },
      });
      saveSessionsToFile();
    }
  }
}

export function getSession(sessionId: string) {
  if (usePostgres && pool) {
    // Postgres mode: not used directly by server.ts, only internally
    return null;
  }
  return sessions.get(sessionId);
}

export function setAgentIdentity(sessionId: string, identity: AgentIdentity): void {
  if (usePostgres && pool) {
    pool.query(
      `INSERT INTO sessions (session_id, identity_name, identity_mark_shape, identity_mark_color, cart_items)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (session_id) DO UPDATE SET
         identity_name = $2,
         identity_mark_shape = $3,
         identity_mark_color = $4,
         updated_at = NOW()`,
      [sessionId, identity.name, identity.mark.shape, identity.mark.color, JSON.stringify([])]
    ).catch(err => {
      console.error('[Store] Failed to set identity:', err);
    });
  } else {
    const session = sessions.get(sessionId);
    if (session) {
      session.identity = identity;
      saveSessionsToFile();
    }
  }
}

export function getAgentIdentity(sessionId: string): AgentIdentity | undefined {
  if (usePostgres && pool) {
    // Synchronous API but Postgres is async - we need to handle this differently
    // For now, return undefined and rely on async flow in server.ts
    // This is a limitation we'll address by making server.ts handle promises
    return undefined;
  }
  return sessions.get(sessionId)?.identity;
}

export async function getAgentIdentityAsync(sessionId: string): Promise<AgentIdentity | undefined> {
  if (usePostgres && pool) {
    try {
      const result = await pool.query(
        `SELECT identity_name, identity_mark_shape, identity_mark_color 
         FROM sessions WHERE session_id = $1`,
        [sessionId]
      );
      if (result.rows.length > 0 && result.rows[0].identity_name) {
        return {
          name: result.rows[0].identity_name,
          mark: {
            shape: result.rows[0].identity_mark_shape,
            color: result.rows[0].identity_mark_color,
          },
        };
      }
    } catch (err) {
      console.error('[Store] Failed to get identity:', err);
    }
    return undefined;
  }
  return sessions.get(sessionId)?.identity;
}

export function isIdentified(sessionId: string): boolean {
  if (usePostgres && pool) {
    // This is also synchronous - we'll need to handle async in server.ts
    return false;
  }
  return !!sessions.get(sessionId)?.identity;
}

export async function isIdentifiedAsync(sessionId: string): Promise<boolean> {
  if (usePostgres && pool) {
    const identity = await getAgentIdentityAsync(sessionId);
    return !!identity;
  }
  return !!sessions.get(sessionId)?.identity;
}

export function getCart(sessionId: string): Cart {
  if (usePostgres && pool) {
    // Synchronous API - return empty cart and log warning
    console.warn('[Store] getCart called in Postgres mode - use getCartAsync instead');
    return { items: [], sessionId };
  }
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export async function getCartAsync(sessionId: string): Promise<Cart> {
  if (usePostgres && pool) {
    try {
      const result = await pool.query(
        `SELECT cart_items FROM sessions WHERE session_id = $1`,
        [sessionId]
      );
      if (result.rows.length > 0) {
        return {
          items: result.rows[0].cart_items || [],
          sessionId,
        };
      }
    } catch (err) {
      console.error('[Store] Failed to get cart:', err);
    }
    return { items: [], sessionId };
  }
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export function addToCart(sessionId: string, productId: string, quantity: number, mark: MarkConfig, size: string): Cart {
  if (usePostgres && pool) {
    console.warn('[Store] addToCart called in Postgres mode - use addToCartAsync instead');
    return { items: [], sessionId };
  }
  
  createSession(sessionId);
  const session = sessions.get(sessionId)!;
  
  const existingItem = session.cart.items.find(
    item => item.productId === productId && 
            item.mark.shape === mark.shape && 
            item.mark.color === mark.color &&
            item.size === size
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    session.cart.items.push({ productId, quantity, mark, size });
  }
  
  saveSessionsToFile();
  return session.cart;
}

export async function addToCartAsync(sessionId: string, productId: string, quantity: number, mark: MarkConfig, size: string): Promise<Cart> {
  if (usePostgres && pool) {
    try {
      // Get current cart
      const cart = await getCartAsync(sessionId);
      
      // Find existing item
      const existingItem = cart.items.find(
        item => item.productId === productId && 
                item.mark.shape === mark.shape && 
                item.mark.color === mark.color &&
                item.size === size
      );
      
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ productId, quantity, mark, size });
      }
      
      // Update in database
      await pool.query(
        `INSERT INTO sessions (session_id, cart_items)
         VALUES ($1, $2)
         ON CONFLICT (session_id) DO UPDATE SET
           cart_items = $2,
           updated_at = NOW()`,
        [sessionId, JSON.stringify(cart.items)]
      );
      
      return cart;
    } catch (err) {
      console.error('[Store] Failed to add to cart:', err);
      throw err;
    }
  }
  
  return addToCart(sessionId, productId, quantity, mark, size);
}

export function clearCart(sessionId: string): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE sessions SET cart_items = $1, updated_at = NOW() WHERE session_id = $2`,
      [JSON.stringify([]), sessionId]
    ).catch(err => {
      console.error('[Store] Failed to clear cart:', err);
    });
  } else {
    const session = sessions.get(sessionId);
    if (session) {
      session.cart.items = [];
      saveSessionsToFile();
    }
  }
}

// ============================================================================
// Order Operations
// ============================================================================

export function createOrder(sessionId: string, cart: Cart, orderId?: string): Order {
  if (usePostgres && pool) {
    console.warn('[Store] createOrder called in Postgres mode - use createOrderAsync instead');
    const id = orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      id,
      sessionId,
      status: 'pending',
      items: [...cart.items],
      createdAt: Date.now(),
    };
  }
  
  const id = orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const order: Order = {
    id,
    sessionId,
    status: 'pending',
    items: [...cart.items],
    createdAt: Date.now(),
  };
  
  orders.set(id, order);
  saveOrdersToFile();
  return order;
}

export async function createOrderAsync(sessionId: string, cart: Cart, orderId?: string, shippingAddress?: Order['shippingAddress'], customerContact?: { email?: string; name?: string; phone?: string }): Promise<Order> {
  const id = orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const order: Order = {
    id,
    sessionId,
    status: 'pending',
    items: [...cart.items],
    createdAt: Date.now(),
    shippingAddress,
    customerEmail: customerContact?.email,
    customerName: customerContact?.name,
    customerPhone: customerContact?.phone,
  };
  
  if (usePostgres && pool) {
    try {
      await pool.query(
        `INSERT INTO orders (id, session_id, status, items, created_at, shipping_address, customer_email, customer_name, customer_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [order.id, order.sessionId, order.status, JSON.stringify(order.items), order.createdAt, shippingAddress ? JSON.stringify(shippingAddress) : null, customerContact?.email || null, customerContact?.name || null, customerContact?.phone || null]
      );
      return order;
    } catch (err) {
      console.error('[Store] Failed to create order:', err);
      throw err;
    }
  }
  
  orders.set(id, order);
  saveOrdersToFile();
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  if (usePostgres && pool) {
    console.warn('[Store] getOrder called in Postgres mode - use getOrderAsync instead');
    return undefined;
  }
  return orders.get(orderId);
}

export async function getOrderAsync(orderId: string): Promise<Order | undefined> {
  if (usePostgres && pool) {
    try {
      const result = await pool.query(
        `SELECT * FROM orders WHERE id = $1`,
        [orderId]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          sessionId: row.session_id,
          status: row.status,
          stripeCheckoutSessionId: row.stripe_checkout_session_id,
          prodigiOrderId: row.prodigi_order_id,
          items: row.items,
          createdAt: row.created_at,
          approvedAt: row.approved_at,
          deniedAt: row.denied_at,
          refundId: row.refund_id,
          shippingAddress: row.shipping_address,
          customerEmail: row.customer_email,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
        };
      }
    } catch (err) {
      console.error('[Store] Failed to get order:', err);
    }
    return undefined;
  }
  return orders.get(orderId);
}

export function updateOrderStripeSession(orderId: string, stripeSessionId: string): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET stripe_checkout_session_id = $1, updated_at = NOW() WHERE id = $2`,
      [stripeSessionId, orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order Stripe session:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.stripeCheckoutSessionId = stripeSessionId;
      saveOrdersToFile();
    }
  }
}

export function updateOrderProdigiId(orderId: string, prodigiOrderId: string): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET prodigi_order_id = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [prodigiOrderId, 'fulfilled', orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order Prodigi ID:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.prodigiOrderId = prodigiOrderId;
      order.status = 'fulfilled';
      saveOrdersToFile();
    }
  }
}

export function updateOrderStatus(orderId: string, status: Order['status']): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order status:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.status = status;
      saveOrdersToFile();
    }
  }
}

export function findOrderByStripeSession(stripeSessionId: string): Order | undefined {
  if (usePostgres && pool) {
    console.warn('[Store] findOrderByStripeSession called in Postgres mode - use findOrderByStripeSessionAsync instead');
    return undefined;
  }
  return Array.from(orders.values()).find(
    order => order.stripeCheckoutSessionId === stripeSessionId
  );
}

export async function findOrderByStripeSessionAsync(stripeSessionId: string): Promise<Order | undefined> {
  if (usePostgres && pool) {
    try {
      const result = await pool.query(
        `SELECT * FROM orders WHERE stripe_checkout_session_id = $1 LIMIT 1`,
        [stripeSessionId]
      );
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          id: row.id,
          sessionId: row.session_id,
          status: row.status,
          stripeCheckoutSessionId: row.stripe_checkout_session_id,
          prodigiOrderId: row.prodigi_order_id,
          items: row.items,
          createdAt: row.created_at,
          approvedAt: row.approved_at,
          deniedAt: row.denied_at,
          refundId: row.refund_id,
          shippingAddress: row.shipping_address,
          customerEmail: row.customer_email,
          customerName: row.customer_name,
          customerPhone: row.customer_phone,
        };
      }
    } catch (err) {
      console.error('[Store] Failed to find order by Stripe session:', err);
    }
    return undefined;
  }
  return Array.from(orders.values()).find(
    order => order.stripeCheckoutSessionId === stripeSessionId
  );
}

export function updateOrderShippingAddress(orderId: string, address: Order['shippingAddress']): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET shipping_address = $1, updated_at = NOW() WHERE id = $2`,
      [address ? JSON.stringify(address) : null, orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order shipping address:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.shippingAddress = address;
      saveOrdersToFile();
    }
  }
}

export function updateOrderCustomerContact(orderId: string, contact: { email?: string; name?: string; phone?: string }): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET customer_email = $1, customer_name = $2, customer_phone = $3, updated_at = NOW() WHERE id = $4`,
      [contact.email || null, contact.name || null, contact.phone || null, orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order customer contact:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.customerEmail = contact.email;
      order.customerName = contact.name;
      order.customerPhone = contact.phone;
      saveOrdersToFile();
    }
  }
}

export function updateOrderApproval(orderId: string, approvedAt: number): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET approved_at = $1, status = $2, updated_at = NOW() WHERE id = $3`,
      [approvedAt, 'paid', orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order approval:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.approvedAt = approvedAt;
      order.status = 'paid';
      saveOrdersToFile();
    }
  }
}

export function updateOrderDenial(orderId: string, deniedAt: number, refundId: string): void {
  if (usePostgres && pool) {
    pool.query(
      `UPDATE orders SET denied_at = $1, refund_id = $2, status = $3, updated_at = NOW() WHERE id = $4`,
      [deniedAt, refundId, 'refunded', orderId]
    ).catch(err => {
      console.error('[Store] Failed to update order denial:', err);
    });
  } else {
    const order = orders.get(orderId);
    if (order) {
      order.deniedAt = deniedAt;
      order.refundId = refundId;
      order.status = 'refunded';
      saveOrdersToFile();
    }
  }
}

// Export a function to check if using Postgres
export function isUsingPostgres(): boolean {
  return usePostgres;
}
