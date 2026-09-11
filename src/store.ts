import type { AgentIdentity, Cart, CartItem, Order, MarkConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSessions(): Map<string, { identity?: AgentIdentity; cart: Cart }> {
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

function loadOrders(): Map<string, Order> {
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

function saveSessions(): void {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(sessions.entries());
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save sessions:', err);
  }
}

function saveOrders(): void {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(orders.entries());
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save orders:', err);
  }
}

const sessions = loadSessions();
const orders = loadOrders();

console.log(`[Store] Loaded ${sessions.size} sessions and ${orders.size} orders from ${DATA_DIR}`);

export function createSession(sessionId: string): void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      cart: { items: [], sessionId },
    });
    saveSessions();
  }
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function setAgentIdentity(sessionId: string, identity: AgentIdentity): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.identity = identity;
    saveSessions();
  }
}

export function getAgentIdentity(sessionId: string): AgentIdentity | undefined {
  return sessions.get(sessionId)?.identity;
}

export function isIdentified(sessionId: string): boolean {
  return !!sessions.get(sessionId)?.identity;
}

export function getCart(sessionId: string): Cart {
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export function addToCart(sessionId: string, productId: string, quantity: number, mark: MarkConfig, size: string): Cart {
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
  
  saveSessions();
  return session.cart;
}

export function clearCart(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.cart.items = [];
    saveSessions();
  }
}

export function createOrder(sessionId: string, cart: Cart, orderId?: string): Order {
  const id = orderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const order: Order = {
    id,
    sessionId,
    status: 'pending',
    items: [...cart.items],
    createdAt: Date.now(),
  };
  
  orders.set(id, order);
  saveOrders();
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

export function updateOrderStripeSession(orderId: string, stripeSessionId: string): void {
  const order = orders.get(orderId);
  if (order) {
    order.stripeCheckoutSessionId = stripeSessionId;
    saveOrders();
  }
}

export function updateOrderProdigiId(orderId: string, prodigiOrderId: string): void {
  const order = orders.get(orderId);
  if (order) {
    order.prodigiOrderId = prodigiOrderId;
    order.status = 'fulfilled';
    saveOrders();
  }
}

export function updateOrderStatus(orderId: string, status: Order['status']): void {
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
    saveOrders();
  }
}

export function findOrderByStripeSession(stripeSessionId: string): Order | undefined {
  return Array.from(orders.values()).find(
    order => order.stripeCheckoutSessionId === stripeSessionId
  );
}
