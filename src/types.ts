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
    size: string;
  };
}

export interface MarkConfig {
  shape: string;
  color: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  mark: MarkConfig;
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
