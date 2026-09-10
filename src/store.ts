import type { AgentIdentity, Cart, CartItem, Order } from './types';

const sessions = new Map<string, { agent?: AgentIdentity; cart: Cart }>();
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

export function setAgentIdentity(sessionId: string, agent: AgentIdentity): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.agent = agent;
  }
}

export function getAgentIdentity(sessionId: string): AgentIdentity | undefined {
  return sessions.get(sessionId)?.agent;
}

export function isGrokBotFamily(agent?: AgentIdentity): boolean {
  if (!agent) return false;
  
  const grokPatterns = [
    /grok\s*bot/i,
    /chief\s*of\s*staff/i,
    /shopping\s*bot/i,
    /grok/i,
  ];
  
  const nameMatch = grokPatterns.some(pattern => pattern.test(agent.name));
  const familyMatch = agent.family && grokPatterns.some(pattern => pattern.test(agent.family));
  
  return nameMatch || familyMatch;
}

export function getCart(sessionId: string): Cart {
  createSession(sessionId);
  return sessions.get(sessionId)!.cart;
}

export function addToCart(sessionId: string, productId: string, quantity: number): Cart {
  const session = sessions.get(sessionId);
  if (!session) {
    createSession(sessionId);
    return addToCart(sessionId, productId, quantity);
  }
  
  const existingItem = session.cart.items.find(item => item.productId === productId);
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    session.cart.items.push({ productId, quantity });
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
