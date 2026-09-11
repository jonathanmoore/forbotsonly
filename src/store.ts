import type { AgentIdentity, Cart, CartItem, Order, MarkConfig } from './types';

const sessions = new Map<string, { identity?: AgentIdentity; cart: Cart }>();
const orders = new Map<string, Order>();

export function createSession(sessionId: string): void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      cart: { items: [], sessionId },
    });
  }
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}

export function setAgentIdentity(sessionId: string, identity: AgentIdentity): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.identity = identity;
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

export function addToCart(sessionId: string, productId: string, quantity: number, mark: MarkConfig): Cart {
  createSession(sessionId);
  const session = sessions.get(sessionId)!;
  
  const existingItem = session.cart.items.find(
    item => item.productId === productId && 
            item.mark.shape === mark.shape && 
            item.mark.color === mark.color
  );
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    session.cart.items.push({ productId, quantity, mark });
  }
  
  return session.cart;
}

export function clearCart(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.cart.items = [];
  }
}

export function createOrder(sessionId: string, cart: Cart): Order {
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const order: Order = {
    id: orderId,
    sessionId,
    status: 'pending',
    items: [...cart.items],
    createdAt: Date.now(),
  };
  
  orders.set(orderId, order);
  return order;
}

export function getOrder(orderId: string): Order | undefined {
  return orders.get(orderId);
}

export function updateOrderStripeSession(orderId: string, stripeSessionId: string): void {
  const order = orders.get(orderId);
  if (order) {
    order.stripeCheckoutSessionId = stripeSessionId;
  }
}

export function updateOrderProdigiId(orderId: string, prodigiOrderId: string): void {
  const order = orders.get(orderId);
  if (order) {
    order.prodigiOrderId = prodigiOrderId;
    order.status = 'fulfilled';
  }
}

export function updateOrderStatus(orderId: string, status: Order['status']): void {
  const order = orders.get(orderId);
  if (order) {
    order.status = status;
  }
}

export function findOrderByStripeSession(stripeSessionId: string): Order | undefined {
  return Array.from(orders.values()).find(
    order => order.stripeCheckoutSessionId === stripeSessionId
  );
}
