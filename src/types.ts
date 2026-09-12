export interface AgentIdentity {
  name: string;
  mark: MarkConfig;
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
  };
  availableSizes: string[];
}

export interface MarkConfig {
  shape: string;
  color: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  mark: MarkConfig;
  size: string;
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
  status: 'pending' | 'awaiting_approval' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled';
  items: CartItem[];
  createdAt: number;
  approvedAt?: number;
  deniedAt?: number;
  refundId?: string;
  shippingAddress?: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

export const MARK_SHAPES = [
  'circle',
  'vertical-oval',
  'rounded-square',
  'horizontal-pill',
  'rounded-triangle',
  'hexagon',
  'cloud',
  'teardrop',
] as const;

export const MARK_COLORS = [
  'white',
  'brown',
  'red',
  'orange',
  'gold',
  'light-green',
  'teal',
  'blue',
  'purple',
  'hot-pink',
  'grey',
] as const;

// DEFAULT_MARK is ONLY used as admin recovery fallback in recover_paid_checkout
// when original order mark is lost. NOT for buyer bot identity - bots must verify
// their own profile mark or get random assignment via identify_agent.
export const DEFAULT_MARK: MarkConfig = {
  shape: 'hexagon',
  color: 'orange',
};

export type MarkShape = typeof MARK_SHAPES[number];
export type MarkColor = typeof MARK_COLORS[number];

export function isValidMarkShape(shape: string): shape is MarkShape {
  return MARK_SHAPES.includes(shape as MarkShape);
}

export function isValidMarkColor(color: string): color is MarkColor {
  return MARK_COLORS.includes(color as MarkColor);
}
