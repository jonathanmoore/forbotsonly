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
    
    // Create orders table only - sessions are always in-memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        status TEXT NOT NULL,
        stripe_checkout_session_id TEXT,
        prodigi_order_id TEXT,
        items JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
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
    console.log('[Store] Connected to Postgres - orders only (sessions in-memory)');
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
        `INSERT INTO orders (id, session_id, status, stripe_checkout_session_id, prodigi_order_id, items, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          order.id,
          order.sessionId,
          order.status,
          order.stripeCheckoutSessionId || null,
          order.prodigiOrderId || null,
          JSON.stringify(order.items),
          order.createdAt,
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
  // Sessions are always in-memory, regardless of Postgres config
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      cart: { items: [], sessionId },
    });
    // Save to file only if not using Postgres
    if (!usePostgres) {
      saveSessionsToFile();
    }
  }
}

export function getSession(sessionId: string) {
  // Sessions are always in-memory
  return sessions.get(sessionId);
}

export function setAgentIdentity(sessionId: string, identity: AgentIdentity): void {
  // Sessions are always in-memory
  const session = sessions.get(sessionId);
  if (session) {
    session.identity = identity;
    // Save to file only if not using Postgres
    if (!usePostgres) {
      saveSessionsToFile();
    }
  }
}

export function getAgentIdentity(sessionId: string): AgentIdentity | undefined {
  // Sessions are always in-memory
  return sessions.get(sessionId)?.identity;
}

export async function getAgentIdentityAsync(sessionId: string): Promise<AgentIdentity | undefined> {
  // Sessions are always in-memory
  return sessions.get(sessionId)?.identity;
}

export function isIdentified(sessionId: string): boolean {
  // Sessions are always in-memory
  return !!sessions.get(sessionId)?.identity;
}

export async function isIdentifiedAsync(sessionId: string): Promise<boolean> {
  // Sessions are always in-memory
  return !!sessions.get(sessionId)?.identity;
}

export function getCart(sessionId: string): Cart {
  // Sessions are always in-memory
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export async function getCartAsync(sessionId: string): Promise<Cart> {
  // Sessions are always in-memory
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export function addToCart(sessionId: string, productId: string, quantity: number, mark: MarkConfig, size: string): Cart {
  // Sessions are always in-memory
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
  
  // Save to file only if not using Postgres
  if (!usePostgres) {
    saveSessionsToFile();
  }
  return session.cart;
}

export async function addToCartAsync(sessionId: string, productId: string, quantity: number, mark: MarkConfig, size: string): Promise<Cart> {
  // Sessions are always in-memory
  return addToCart(sessionId, productId, quantity, mark, size);
}

export function clearCart(sessionId: string): void {
  // Sessions are always in-memory
  const session = sessions.get(sessionId);
  if (session) {
    session.cart.items = [];
    // Save to file only if not using Postgres
    if (!usePostgres) {
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

export async function createOrderAsync(sessionId: string, cart: Cart, orderId?: string): Promise<Order> {
  const id = orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const order: Order = {
    id,
    sessionId,
    status: 'pending',
    items: [...cart.items],
    createdAt: Date.now(),
  };
  
  if (usePostgres && pool) {
    try {
      await pool.query(
        `INSERT INTO orders (id, session_id, status, items, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, order.sessionId, order.status, JSON.stringify(order.items), order.createdAt]
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

// Export a function to check if using Postgres
export function isUsingPostgres(): boolean {
  return usePostgres;
}
