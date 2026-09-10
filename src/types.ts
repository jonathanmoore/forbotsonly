export interface AgentIdentity {
  name: string;
  family?: string;
  capabilities?: string[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  attributes: {
    color: string;
    size: string;
  };
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  sessionId: string;
}

export interface Order {
  id: string;
  sessionId: string;
  stripeCheckoutSessionId?: string;
  prodigiOrderId?: string;
  status: 'pending' | 'paid' | 'fulfilled';
  items: CartItem[];
  createdAt: number;
}
